import { from, map, Observable, of } from 'rxjs';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse, MetricFindValue } from '@grafana/data';

import { getTimeSrv, TimeSrv } from '../../../features/dashboard/services/TimeSrv';

import { VariableQueryEditor } from './VariableQueryEditor';
import { PyroscopeDataSource } from './datasource';
import { ProfileTypeMessage, VariableQuery } from './types';

export interface DataAPI {
  getProfileTypes(): Promise<ProfileTypeMessage[]>;
  getLabelNames(query: string, start: number, end: number): Promise<string[]>;
  getLabelValues(query: string, label: string, start: number, end: number): Promise<string[]>;
}

export class VariableSupport extends CustomVariableSupport<PyroscopeDataSource> {
  constructor(
    private readonly dataAPI: DataAPI,
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super();
  }

  editor = VariableQueryEditor;

  query(request: DataQueryRequest<VariableQuery>): Observable<DataQueryResponse> {
    if (request.targets[0].type === 'profileType') {
      return from(this.dataAPI.getProfileTypes()).pipe(
        map((values) => {
          return { data: values.map<MetricFindValue>((v) => ({ text: v.label, value: v.id })) };
        })
      );
    }

    if (request.targets[0].type === 'label') {
      if (!request.targets[0].profileTypeId) {
        return of({ data: [] });
      }
      return from(
        this.dataAPI.getLabelNames(
          request.targets[0].profileTypeId + '{}',
          this.timeSrv.timeRange().from.valueOf(),
          this.timeSrv.timeRange().to.valueOf()
        )
      ).pipe(
        map((values) => {
          return { data: values.map((v) => ({ text: v })) };
        })
      );
    }

    if (request.targets[0].type === 'labelValue') {
      if (!request.targets[0].labelName || !request.targets[0].profileTypeId) {
        return of({ data: [] });
      }
      return from(
        this.dataAPI.getLabelValues(
          request.targets[0].profileTypeId + '{}',
          request.targets[0].labelName,
          this.timeSrv.timeRange().from.valueOf(),
          this.timeSrv.timeRange().to.valueOf()
        )
      ).pipe(
        map((values) => {
          return { data: values.map((v) => ({ text: v })) };
        })
      );
    }

    return of({ data: [] });
  }
}
