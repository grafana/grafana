import React from 'react';
import { useAsync } from 'react-use';
import { from, map, Observable, of } from 'rxjs';

import {
  CustomVariableSupport,
  DataQueryRequest,
  DataQueryResponse,
  MetricFindValue,
  QueryEditorProps,
  SelectableValue,
} from '@grafana/data';
import { InlineField, InlineFieldRow, LoadingPlaceholder, Select } from '@grafana/ui';

import { getTimeSrv, TimeSrv } from '../../../features/dashboard/services/TimeSrv';

import { ProfileTypesCascader, useProfileTypes } from './QueryEditor/ProfileTypesCascader';
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
      return from(
        this.datasource.getLabelNames(
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
        this.datasource.getLabelValues(
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

      {(props.query.type === 'labelValue' || props.query.type === 'label') && (
        <ProfileTypeRow
          datasource={props.datasource}
          initialValue={props.query.profileTypeId}
          onChange={(val) => {
            // To make TS happy
            if (props.query.type === 'label' || props.query.type === 'labelValue') {
              props.onChange({ ...props.query, profileTypeId: val });
            }
          }}
        />
      )}

      {props.query.type === 'labelValue' && (
        <LabelRow
          value={props.query.labelName}
          datasource={props.datasource}
          profileTypeId={props.query.profileTypeId}
          onChange={(val) => {
            if (props.query.type === 'labelValue') {
              props.onChange({ ...props.query, labelName: val });
            }
          }}
          from={props.range?.from.valueOf() || Date.now().valueOf() - 1000 * 60 * 60 * 24}
          to={props.range?.to.valueOf() || Date.now().valueOf()}
        />
      )}
    </>
  );
}

function LabelRow(props: {
  value: string;
  datasource: PhlareDataSource;
  profileTypeId: string;
  from: number;
  to: number;
  onChange: (val: string) => void;
}) {
  const labelsResult = useAsync(() => {
    return props.datasource.getLabelNames(props.profileTypeId + '{}', props.from, props.to);
  }, [props.datasource, props.profileTypeId, props.to, props.from]);

  const options = labelsResult.value ? labelsResult.value.map<SelectableValue>((v) => ({ label: v, value: v })) : [];
  if (labelsResult.value && !labelsResult.value.find((v) => v === props.value)) {
    options.push({ value: props.value, label: props.value });
  }

  return (
    <InlineFieldRow>
      <InlineField
        label={'Label'}
        labelWidth={20}
        tooltip={<div>Select label for which to retrieve available values</div>}
      >
        <Select
          allowCustomValue={true}
          placeholder="Select label"
          aria-label="Select label"
          width={25}
          options={options}
          onChange={(option) => props.onChange(option.value)}
          value={props.value}
        />
      </InlineField>
    </InlineFieldRow>
  );
}

function ProfileTypeRow(props: {
  datasource: PhlareDataSource;
  onChange: (val: string) => void;
  initialValue?: string;
}) {
  const profileTypes = useProfileTypes(props.datasource);
  return (
    <InlineFieldRow>
      <InlineField
        label={props.datasource.backendType === 'phlare' ? 'Profile type' : 'Application'}
        labelWidth={20}
        tooltip={
          <div>
            Select {props.datasource.backendType === 'phlare' ? 'profile type' : 'application'} for which to retrieve
            available labels
          </div>
        }
      >
        {profileTypes ? (
          <ProfileTypesCascader
            onChange={props.onChange}
            profileTypes={profileTypes}
            initialProfileTypeId={props.initialValue}
          />
        ) : (
          <LoadingPlaceholder text={'Loading'} />
        )}
      </InlineField>
    </InlineFieldRow>
  );
}
