import { type RuleNamespace } from 'app/types/unified-alerting';

import { type TreeDataSource, type TreeFolder, type TreeModel } from './types';

export interface DataSourceInput {
  uid: string;
  name: string;
  isGrafana: boolean;
  namespaces?: RuleNamespace[];
  error?: string;
}

export function buildTreeModel(inputs: DataSourceInput[]): TreeModel {
  const dataSources: TreeDataSource[] = inputs.map((input) => ({
    uid: input.uid,
    name: input.name,
    isGrafana: input.isGrafana,
    error: input.error,
    folders: toFolders(input.namespaces ?? []),
  }));

  return { dataSources };
}

function toFolders(namespaces: RuleNamespace[]): TreeFolder[] {
  const folders = namespaces.map<TreeFolder>((namespace) => ({
    key: folderKeyFromNamespace(namespace),
    title: namespace.name,
    groups: namespace.groups,
  }));

  // eslint-disable-next-line @grafana/no-locale-compare -- folder lists are small and user-facing
  folders.sort((a, b) => a.title.localeCompare(b.title));
  return folders;
}

export function folderKeyFromNamespace(namespace: RuleNamespace): string {
  const firstRule = namespace.groups[0]?.rules[0];
  if (firstRule && 'folderUid' in firstRule && firstRule.folderUid) {
    return firstRule.folderUid;
  }
  return namespace.name;
}

export function findFolder(model: TreeModel, dataSourceUid: string, folderKey: string): TreeFolder | undefined {
  const ds = model.dataSources.find((d) => d.uid === dataSourceUid);
  return ds?.folders.find((f) => f.key === folderKey);
}

export function findDataSource(model: TreeModel, dataSourceUid: string): TreeDataSource | undefined {
  return model.dataSources.find((d) => d.uid === dataSourceUid);
}
