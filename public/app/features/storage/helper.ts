import { DataFrame, dataFrameFromJSON } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

// Likely should be built into the search interface!
export interface GrafanaStorage {
  list: (path: string) => Promise<DataFrame | undefined>;
}

class SimpleStorage implements GrafanaStorage {
  constructor() {}

  async list(path: string): Promise<DataFrame | undefined> {
    let url = 'api/storage/list/';
    if (path) {
      url += path + '/';
    }
    const rsp = await getBackendSrv().get(url); // as DataFrameJSON;
    if (rsp && rsp.data) {
      return dataFrameFromJSON(rsp);
    }
    return undefined;
  }
}

let storage: GrafanaStorage | undefined;

export function getGrafanaStorage() {
  if (!storage) {
    storage = new SimpleStorage();
  }
  return storage;
}
