import { cloneDeep } from 'lodash';

import { type SceneVariable } from '@grafana/scenes';
import { type Spec as DashboardV2Spec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

/** K8s label on Variable resources for folder scope (see pkg/registry/apis/dashboard/variable_fields.go). */
export const VARIABLE_FOLDER_LABEL_KEY = 'dashboard.grafana.app/folder';

const ORG_SCOPE_GROUP = 'org';

/**
 * Pairs a {@link VariableKind} produced by the globals service with its scope label.
 * The scope is used for display/tooltip purposes at the UI layer and for sort order.
 */
export interface GlobalVariableDefault {
  kind: VariableKind;
  scope: string;
}

/**
 * Runtime-only registry of SceneVariables that came from the global dashboard variables
 * service. This is intentionally a side channel: the dashboard v2 schema (and the
 * `@grafana/scenes` `ControlSourceRef` type) model `origin` narrowly as
 * `{ type: 'datasource', group: string }`, and global variables should never persist to
 * disk. We set `state.origin = { type: 'datasource', group: <scope> }` to keep the
 * serializer's `origin !== undefined` persistence skip working, and use this WeakSet to
 * distinguish globals from real datasource defaults without widening any schema.
 */
const globalSceneVariables = new WeakSet<SceneVariable>();
const globalSceneVariableScopes = new WeakMap<SceneVariable, string>();

export function markAsGlobalSceneVariable(v: SceneVariable, scope: string): void {
  globalSceneVariables.add(v);
  globalSceneVariableScopes.set(v, scope);
}

export function isGlobalSceneVariable(v: SceneVariable): boolean {
  return globalSceneVariables.has(v);
}

export function getGlobalSceneVariableScope(v: SceneVariable): string | undefined {
  return globalSceneVariableScopes.get(v);
}

export function getDashboardVariablesK8sClient() {
  return new ScopedResourceClient<VariableKind>(
    {
      group: 'dashboard.grafana.app',
      version: dashboardAPIVersionResolver.getV2(),
      resource: 'variables',
    },
    true
  );
}

/**
 * Sort globals by scope (`org` first, then folder UID) then by name. Used for the
 * order in which globals appear alongside datasource defaults in the variables list.
 */
export function sortGlobalVariableDefaults(defaults: GlobalVariableDefault[]): GlobalVariableDefault[] {
  const collator = new Intl.Collator();
  return [...defaults].sort((a, b) => {
    const scopeCmp = collator.compare(a.scope, b.scope);
    return scopeCmp !== 0 ? scopeCmp : collator.compare(a.kind.spec.name, b.kind.spec.name);
  });
}

/**
 * Prepare a {@link VariableKind} returned by the globals service for injection as a
 * non-persisted default: stamp `origin = { type: 'datasource', group: <scope> }` so the
 * dashboard serializer skips it (gate: `origin !== undefined`). The global-vs-datasource
 * distinction is carried out-of-band via {@link markAsGlobalSceneVariable} once the
 * {@link SceneVariable} is constructed.
 */
export function tagVariableKindAsGlobalDefault(
  v: VariableKind,
  scope: 'org' | 'folder',
  folderUid?: string
): GlobalVariableDefault {
  const resolvedScope = scope === 'org' ? ORG_SCOPE_GROUP : (folderUid ?? ORG_SCOPE_GROUP);
  const kind = cloneDeep(v);
  kind.spec.origin = {
    type: 'datasource',
    group: resolvedScope,
  };
  return { kind, scope: resolvedScope };
}

/**
 * Lists org-wide and folder-scoped variables from the dashboard variables API and returns
 * them tagged as {@link GlobalVariableDefault}s for default injection. Names that already
 * exist on the dashboard spec are skipped so persisted dashboard variables win.
 */
export async function fetchGlobalDashboardVariablesForLoad(
  rsp: DashboardWithAccessInfo<DashboardV2Spec>,
  folderUidOverride?: string
): Promise<GlobalVariableDefault[]> {
  const client = getDashboardVariablesK8sClient();
  const dashboardVarNames = new Set((rsp.spec.variables ?? []).map((v) => v.spec.name));
  const folderUid = rsp.metadata.annotations?.[AnnoKeyFolder] ?? folderUidOverride;

  const { items } = await client.list({});
  const seen = new Set<string>();
  const result: GlobalVariableDefault[] = [];

  const considerItem = (item: (typeof items)[0], scope: 'org' | 'folder', scopeFolderUid?: string) => {
    const spec = item.spec;
    if (!spec?.spec?.name) {
      return;
    }
    const name = spec.spec.name;
    if (dashboardVarNames.has(name) || seen.has(name)) {
      return;
    }
    seen.add(name);
    result.push(tagVariableKindAsGlobalDefault(spec, scope, scopeFolderUid));
  };

  for (const item of items) {
    const labelFolder = item.metadata.labels?.[VARIABLE_FOLDER_LABEL_KEY];
    if (!labelFolder) {
      considerItem(item, 'org');
    }
  }

  if (folderUid) {
    for (const item of items) {
      const labelFolder = item.metadata.labels?.[VARIABLE_FOLDER_LABEL_KEY];
      if (labelFolder === folderUid) {
        considerItem(item, 'folder', folderUid);
      }
    }
  }

  return sortGlobalVariableDefaults(result);
}
