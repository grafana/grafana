import { BASE_URL } from '@grafana/api-clients/rtkq/dashboard/v2beta1';
import { getBackendSrv } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type Variable, type VariableList } from 'app/api/clients/dashboard/v2beta1';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { getVariableKind, getVariableSpecName } from 'app/features/variables-management/utils';

import { predefinedVariablesCache } from './cache';
import { type PredefinedControlSourceRef, toControlSourceRef } from './predefinedVariableOrigin';

/** The backend mirrors the folder annotation into this label on Variable resources. */
const FOLDER_LABEL_KEY = AnnoKeyFolder;

const LIST_PAGE_SIZE = 500;

/**
 * Keeps repeat dashboard loads cheap (e.g. switching between dashboards in the same
 * folder) without holding on to stale variables for long.
 */
const PREDEFINED_VARIABLES_CACHE_TTL = 30_000;

/**
 * Fetches the predefined (global + folder-scoped) variables applicable to a dashboard,
 * tagged with their origin and with folder-over-global name precedence applied.
 *
 * Returns `null` on fetch failure so callers can choose fail-open (initial load) vs
 * keep-current (refresh). An empty array means a successful fetch with no variables.
 */
export async function fetchPredefinedVariables(folderUid?: string): Promise<VariableKind[] | null> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardGlobalVariables, false)) {
    return [];
  }

  const cacheKey = folderUid ?? '';
  const cached = predefinedVariablesCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < PREDEFINED_VARIABLES_CACHE_TTL) {
    return cached.variables;
  }

  try {
    const [globalVariables, folderVariables] = await Promise.all([
      listVariables(`!${FOLDER_LABEL_KEY}`),
      folderUid ? listVariables(`${FOLDER_LABEL_KEY}=${folderUid}`) : Promise.resolve([]),
    ]);

    const variables = mergePredefinedVariables(globalVariables, folderVariables, folderUid);
    predefinedVariablesCache.set(cacheKey, { ts: Date.now(), variables });
    return variables;
  } catch (err) {
    console.warn('Failed to load predefined dashboard variables', err);
    return null;
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
