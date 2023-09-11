import React, { useEffect, useState } from 'react';

import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, LoadingPlaceholder, Select } from '@grafana/ui';

import { ProfileTypesCascader, useProfileTypes } from './QueryEditor/ProfileTypesCascader';
import { PhlareDataSource } from './datasource';
import { Query, VariableQuery } from './types';

export function VariableQueryEditor(props: QueryEditorProps<PhlareDataSource, Query, {}, VariableQuery>) {
  return (
    <>
      <InlineFieldRow>
        <InlineField
          label="Query type"
          labelWidth={20}
          tooltip={
            <div>The Prometheus data source plugin provides the following query types for template variables</div>
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
  datasource: PhlareDataSource;
  value?: string;
  profileTypeId?: string;
  from: number;
  to: number;
  onChange: (val: string) => void;
}) {
  const [labels, setLabels] = useState<string[]>();
  useEffect(() => {
    (async () => {
      setLabels(await props.datasource.getLabelNames((props.profileTypeId || '') + '{}', props.from, props.to));
    })();
  }, [props.datasource, props.profileTypeId, props.to, props.from]);

  const options = labels ? labels.map<SelectableValue>((v) => ({ label: v, value: v })) : [];
  if (labels && props.value && !labels.find((v) => v === props.value)) {
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
        label={'Profile type'}
        aria-label={'Profile type'}
        labelWidth={20}
        tooltip={
          <div>
            Select profile type for which to retrieve
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
