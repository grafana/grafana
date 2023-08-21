import React, { useState } from 'react';
import { from, map, Observable, of } from 'rxjs';

import {
  CustomVariableSupport,
  DataQueryRequest,
  DataQueryResponse,
  MetricFindValue,
  QueryEditorProps,
} from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';

import { getTimeSrv, TimeSrv } from '../../../features/dashboard/services/TimeSrv';

import { PhlareDataSource } from './datasource';
import { Query } from './types';

export class VariableSupport extends CustomVariableSupport<PhlareDataSource> {
  constructor(
    private readonly datasource: PhlareDataSource,
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super();
    // This is needed because code in queryRunners.ts passes this method without binding it.
    this.query = this.query.bind(this);
  }

  editor = VariableQueryEditor;

  query(request: DataQueryRequest<VariableQuery>): Observable<DataQueryResponse> {
    if (request.targets[0].type === 'profileType') {
      return from(this.datasource.getProfileTypes()).pipe(
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
        this.datasource.getLabelNames(
          request.targets[0].profileTypeId,
          this.timeSrv.timeRange().from.valueOf(),
          this.timeSrv.timeRange().to.valueOf()
        )
      ).pipe(
        map((values) => {
          return { data: values };
        })
      );
    }

    if (request.targets[0].type === 'labelValue') {
      return from(this.datasource.getProfileTypes()).pipe(
        map((values) => {
          return { data: values };
        })
      );
    }

    return of({ data: [] });
  }
}

// type QueryTypes = 'profileType' | 'label' | 'labelValue';

type ProfileTypeQuery = {
  type: 'profileType';
  refId: string;
};

type LabelQuery = {
  type: 'label';
  profileTypeId: string;
  refId: string;
};

type LabelValueQuery = {
  type: 'labelValue';
  profileTypeId: string;
  labelName: string;
  refId: string;
};

type VariableQuery = ProfileTypeQuery | LabelQuery | LabelValueQuery;

function VariableQueryEditor(props: QueryEditorProps<PhlareDataSource, Query, {}, VariableQuery>) {
  return (
    <>
      <InlineFieldRow>
        <InlineField
          label="Query type"
          labelWidth={20}
          tooltip={
            <div>The Prometheus data source plugin provides the following query types for template variables.</div>
          }
        >
          <Select
            placeholder="Select query type"
            aria-label="Query type"
            width={25}
            options={[
              { label: 'Profile type', value: 'profileType' as const },
              { label: 'Label', value: 'label' as const },
              { label: 'Label value', value: 'labelValue' as const },
            ]}
            onChange={(value) => {
              if (value.value! === 'profileType') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                });
              }
              if (value.value! === 'label') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  profileTypeId: '',
                });
              }
              if (value.value! === 'labelValue') {
                props.onChange({
                  ...props.query,
                  type: value.value!,
                  profileTypeId: '',
                  labelName: '',
                });
              }
            }}
            value={props.query.type}
          />
        </InlineField>
      </InlineFieldRow>

      {/*{props.query.type === 'label' && <InlineFieldRow>*/}
      {/*    <InlineField*/}
      {/*        label="Query type"*/}
      {/*        labelWidth={20}*/}
      {/*        tooltip={*/}
      {/*          <div>The Prometheus data source plugin provides the following query types for template variables.</div>*/}
      {/*        }*/}
      {/*    >*/}
      {/*    </InlineField>*/}
      {/*</InlineFieldRow>}*/}
    </>
  );
}
