// import { getBackendSrv } from '@grafana/runtime';

import { BaselineEntryFields } from './types';
import { BaselineDTO } from '../../types';

function loadBaselineEntries(): Promise<BaselineDTO[]> {
  // TODO: replace fabircated promise with commented line below
  // return getBackendSrv().get('/api/baseline');
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve([]);
    }, 3000);
  });
}

async function submitBaselineEntry(payload: BaselineEntryFields): Promise<void> {
  // TODO: replace fabircated promise with commented line below
  // await getBackendSrv().post('/api/baseline/', payload);
  await new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, 3000);
  });
}

export const api = {
  loadBaselineEntries,
  submitBaselineEntry,
};
