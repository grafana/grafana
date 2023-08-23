import { from, map, Observable, of } from 'rxjs';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse, MetricFindValue } from '@grafana/data';

import { getTimeSrv, TimeSrv } from '../../../features/dashboard/services/TimeSrv';

import { VariableQueryEditor } from './VariableQueryEditor';
import { PhlareDataSource } from './datasource';
import { ProfileTypeMessage, VariableQuery } from './types';

export interface DataAPI {
  getProfileTypes(): Promise<ProfileTypeMessage[]>;
  getLabelNames(query: string, start: number, end: number): Promise<string[]>;
  getLabelValues(query: string, label: string, start: number, end: number): Promise<string[]>;
}

export class VariableSupport extends CustomVariableSupport<PhlareDataSource> {
  constructor(
    private readonly dataAPI: DataAPI,
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super();
    // This is needed because code in queryRunners.ts passes this method without binding it.
    this.query = this.query.bind(this);
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
