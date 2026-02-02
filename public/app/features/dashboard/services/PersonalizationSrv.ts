// BMC file for dashboard personalization (Save filter values) service

import { VariableOption } from '@grafana/schema/dist/esm/raw/dashboard/x/dashboard_types.gen';
import { VariableModel } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { getBackendSrv } from 'app/core/services/backend_srv';

export class PersonalizationSrv {
  constructor() {}

  saveFilters(saveModel: { uid: string; time: any; list: VariableModel[]; hasTimeRangeChanged?: boolean }) {
    const data = saveModel.list.reduce(
      (result, filter) => {
        result[`var-${filter.name}`] = { text: filter.current?.text!, value: filter.current?.value!, selected: false };
        return result;
      },
      {} as Record<string, VariableOption> & { time: { from: string; to: string } }
    );

    // We will append time to personalization only if user has changed the time variable.
    if (saveModel.hasTimeRangeChanged) {
      const { from, to } = saveModel.time;
      data.time = { from, to };
    }
    return getBackendSrv().post(`/api/bmc/dashboard/${saveModel.uid}/personalization`, { data });
  }

  resetFilters(dashUid: string) {
    return getBackendSrv().delete(`/api/bmc/dashboard/${dashUid}/personalization`);
  }
}

//
// Code below is to export the service to React components
//

let singletonInstance: PersonalizationSrv;

export function setPersonalizationSrv(instance: PersonalizationSrv) {
  singletonInstance = instance;
}

export function getPersonalizationSrv(): PersonalizationSrv {
  if (!singletonInstance) {
    singletonInstance = new PersonalizationSrv();
  }
  return singletonInstance;
}
