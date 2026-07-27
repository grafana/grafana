import { BASE_URL } from '@grafana/api-clients/rtkq/dashboard/v2beta1';
import { getBackendSrv } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type ControlSourceRef, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Variable, type VariableList } from 'app/api/clients/dashboard/v2beta1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { getVariableKind, getVariableSpecName } from 'app/features/variables-management/utils';

/**
 * Predefined variables are org-wide (global) and folder-scoped Variable resources
 * (`dashboard.grafana.app/v2beta1`) that are injected into every V2 dashboard at load
 * time. They are runtime-only: tagging them with an `origin` keeps them out of the
 * persisted dashboard spec and out of the editable variables list.
 */

interface GlobalControlSourceRef {
  type: 'global';
}

interface FolderControlSourceRef {
  type: 'folder';
  folderUid: string;
}

export type PredefinedControlSourceRef = GlobalControlSourceRef | FolderControlSourceRef;

/**
 * The schema (and scenes) `ControlSourceRef` union currently only has the
 * `datasource` member. Predefined variables reuse the same `origin` mechanism —
 * which drives save-filtering and read-only editor behavior — with their own
 * source types. Widening the published union is a follow-up; until then this is
 * the single sanctioned cast between the two shapes.
 */
export function toControlSourceRef(ref: PredefinedControlSourceRef): ControlSourceRef {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return ref as unknown as ControlSourceRef;
}

export function isPredefinedOrigin(origin: unknown): origin is PredefinedControlSourceRef {
  return (
    typeof origin === 'object' &&
    origin !== null &&
    'type' in origin &&
    (origin.type === 'global' || origin.type === 'folder')
  );
}

/**
 * Widens an `origin` back to the predefined shape. Prefer this over the type guard
 * when the input is typed as the published `ControlSourceRef` union — narrowing that
 * union with the guard collapses to `never` because it only has the datasource member.
 */
export function getPredefinedOrigin(origin: unknown): PredefinedControlSourceRef | undefined {
  return isPredefinedOrigin(origin) ? origin : undefined;
}

/** The backend mirrors the folder annotation into this label on Variable resources. */
const FOLDER_LABEL_KEY = AnnoKeyFolder;

const LIST_PAGE_SIZE = 500;

/**
 * Keeps repeat dashboard loads cheap (e.g. switching between dashboards in the same
 * folder) without holding on to stale variables for long.
 */
const PREDEFINED_VARIABLES_CACHE_TTL = 30_000;

const cache = new Map<string, { ts: number; variables: VariableKind[] }>();

export function clearPredefinedVariablesCache() {
  cache.clear();
}

/**
 * Fetches the predefined (global + folder-scoped) variables applicable to a dashboard,
 * tagged with their origin and with folder-over-global name precedence applied.
 *
 * Fails open: any fetch error resolves to an empty list so the dashboard still loads
 * with its local variables only.
 */
export async function fetchPredefinedVariables(folderUid?: string): Promise<VariableKind[]> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GlobalDashboardVariables, false)) {
    return [];
  }

  const cacheKey = folderUid ?? '';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < PREDEFINED_VARIABLES_CACHE_TTL) {
    return cached.variables;
  }

  try {
    const [globalVariables, folderVariables] = await Promise.all([
      listVariables(`!${FOLDER_LABEL_KEY}`),
      folderUid ? listVariables(`${FOLDER_LABEL_KEY}=${folderUid}`) : Promise.resolve([]),
    ]);

    const variables = mergePredefinedVariables(globalVariables, folderVariables, folderUid);
    cache.set(cacheKey, { ts: Date.now(), variables });
    return variables;
  } catch (err) {
    console.warn('Failed to load predefined dashboard variables', err);
    return [];
  }
}

async function listVariables(labelSelector: string): Promise<Variable[]> {
  const items: Variable[] = [];
  let continueToken: string | undefined;

  do {
    const list = await getBackendSrv().get<VariableList>(
      `${BASE_URL}/variables`,
      {
        labelSelector,
        limit: LIST_PAGE_SIZE,
        ...(continueToken ? { continue: continueToken } : {}),
      },
      undefined,
      { showErrorAlert: false }
    );
    items.push(...(list.items ?? []));
    continueToken = list.metadata?.continue || undefined;
  } while (continueToken);

  return items;
}

/**
 * Applies scope precedence (folder wins over global on name collisions), tags each
 * variable with its origin, and returns them in hierarchy order: global, then
 * folder-scoped — each group sorted by name. Dashboard-local variables are appended
 * later when the scene is built.
 */
function mergePredefinedVariables(
  globalVariables: Variable[],
  folderVariables: Variable[],
  folderUid?: string
): VariableKind[] {
  const collator = new Intl.Collator();
  const byName = (a: Variable, b: Variable) => collator.compare(getVariableSpecName(a), getVariableSpecName(b));

  const folderNames = new Set(folderVariables.map(getVariableSpecName));
  const visibleGlobals = globalVariables.filter((v) => !folderNames.has(getVariableSpecName(v)));

  return [
    ...visibleGlobals.sort(byName).map((v) => toVariableKindWithOrigin(v, { type: 'global' })),
    ...folderVariables
      .sort(byName)
      // The folder branch is only reachable when folderUid is set.
      .map((v) => toVariableKindWithOrigin(v, { type: 'folder', folderUid: folderUid ?? '' })),
  ];
}

function toVariableKindWithOrigin(variable: Variable, origin: PredefinedControlSourceRef): VariableKind {
  const kind = getVariableKind(variable);
  // Spreading collapses the discriminated union correlation between `kind` and
  // `spec`, so the reassembled object needs a cast back to the union type.
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    ...kind,
    spec: {
      ...kind.spec,
      origin: toControlSourceRef(origin),
    },
  } as VariableKind;
}
