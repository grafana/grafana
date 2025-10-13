import { useEffect, useState } from 'react';

import { QueryEditorProps, SelectableValue, TimeRange } from '@grafana/data';
import { InlineField, InlineFieldRow, LoadingPlaceholder, Select } from '@grafana/ui';

import { ProfileTypesCascader, useProfileTypes } from './QueryEditor/ProfileTypesCascader';
import { PyroscopeDataSource } from './datasource';
import { Query, VariableQuery } from './types';

export function VariableQueryEditor(props: QueryEditorProps<PyroscopeDataSource, Query, {}, VariableQuery>) {
  return (
    <>
      <InlineFieldRow>
        <InlineField
          label="Query type"
          labelWidth={20}
          tooltip={
            <div>The Pyroscope data source plugin provides the following query types for template variables</div>
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
                  type: value.value!,
                  refId: props.query.refId,
                });
              }
              if (value.value! === 'label' || value.value! === 'labelValue') {
                props.onChange({
                  type: value.value!,
                  refId: props.query.refId,
                  // Make sure we keep already selected values if they make sense for the variable type
                  profileTypeId: props.query.type !== 'profileType' ? props.query.profileTypeId : '',
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
          range={props.range}
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
  datasource: PyroscopeDataSource;
  value?: string;
  profileTypeId?: string;
  from: number;
  to: number;
  onChange: (val: string) => void;
}) {
  const [labels, setLabels] = useState<string[]>();
  useEffect(() => {
    (async () => {
      setLabels(
        await props.datasource.getLabelNames(
          props.profileTypeId ? getProfileTypeLabel(props.profileTypeId) : '{}',
          props.from,
          props.to
        )
      );
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
  datasource: PyroscopeDataSource;
  onChange: (val: string) => void;
  initialValue?: string;
  range?: TimeRange;
}) {
  const profileTypes = useProfileTypes(props.datasource, props.range);
  return (
    <InlineFieldRow>
      <InlineField
        label={'Profile type'}
        aria-label={'Profile type'}
        labelWidth={20}
        tooltip={<div>Select profile type for which to retrieve available labels</div>}
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

export function getProfileTypeLabel(type: string) {
  return `{__profile_type__="${type}"}`;
}
