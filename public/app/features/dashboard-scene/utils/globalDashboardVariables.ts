import { cloneDeep } from 'lodash';

import { type Spec as DashboardV2Spec, type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { dashboardAPIVersionResolver } from 'app/features/dashboard/api/DashboardAPIVersionResolver';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';


/** K8s label on Variable resources for folder scope (see pkg/registry/apis/dashboard/variable_fields.go). */
export const VARIABLE_FOLDER_LABEL_KEY = 'dashboard.grafana.app/folder';

const ORG_SCOPE_GROUP = 'org';

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
 * Sort merged default variables: datasource (by group) then global service, then by name.
 * Aligns with sortVariables in dashboardControls.ts for datasource defaults.
 */
export function sortGlobalAndDatasourceDefaultVariables(variables: VariableKind[]): VariableKind[] {
  const collator = new Intl.Collator();
  return [...variables].sort((a, b) => {
    const typeOrder = (v: VariableKind) => (v.spec.origin?.type === 'globalvariable' ? 1 : 0);
    const t = typeOrder(a) - typeOrder(b);
    if (t !== 0) {
      return t;
    }
    const groupCmp = collator.compare(a.spec.origin?.group ?? '', b.spec.origin?.group ?? '');
    return groupCmp !== 0 ? groupCmp : collator.compare(a.spec.name, b.spec.name);
  });
}

/**
 * Attach global-variable provenance for injection as dashboard default variables (non-persisted).
 */
export function tagVariableKindAsGlobalDefault(
  v: VariableKind,
  scope: 'org' | 'folder',
  folderUid?: string
): VariableKind {
  const group = scope === 'org' ? ORG_SCOPE_GROUP : folderUid ?? ORG_SCOPE_GROUP;
  const withOrigin = cloneDeep(v);
  withOrigin.spec.origin = {
    type: 'globalvariable',
    group,
  };
  return withOrigin;
}

/**
 * Lists org-wide and folder-scoped variables from the dashboard variables API and returns them
 * as VariableKind entries tagged for default injection. Names that already exist on the dashboard
 * spec are skipped so persisted dashboard variables win.
 */
export async function fetchGlobalDashboardVariablesForLoad(
  rsp: DashboardWithAccessInfo<DashboardV2Spec>,
  folderUidOverride?: string
): Promise<VariableKind[]> {
  const client = getDashboardVariablesK8sClient();
  const dashboardVarNames = new Set((rsp.spec.variables ?? []).map((v) => v.spec.name));
  const folderUid = rsp.metadata.annotations?.[AnnoKeyFolder] ?? folderUidOverride;

  const { items } = await client.list({});
  const seen = new Set<string>();
  const result: VariableKind[] = [];

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

  return sortGlobalAndDatasourceDefaultVariables(result);
}

export function mergeDefaultVariableKinds(
  existing: VariableKind[] | undefined,
  globalVars: VariableKind[]
): VariableKind[] {
  if (!globalVars.length) {
    return existing ?? [];
  }
  return sortGlobalAndDatasourceDefaultVariables([...(existing ?? []), ...globalVars]);
}
