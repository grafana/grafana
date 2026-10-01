import { getDataSourceSrv } from '@grafana/runtime';

import { type PromptDatasource } from './types';

/** Every datasource in the instance, as the prompt's starting scope. */
export function getPromptDatasources(): PromptDatasource[] {
  return getDataSourceSrv()
    .getList()
    .map((ds) => ({ uid: ds.uid, type: ds.type, name: ds.name }));
}
