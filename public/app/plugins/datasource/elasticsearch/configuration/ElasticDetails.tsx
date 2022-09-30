import React from 'react';
import { valid } from 'semver';

import { DataSourceSettings, SelectableValue } from '@grafana/data';
import { FieldSet, InlineField, Input, Select, InlineSwitch } from '@grafana/ui';
import { isTruthy } from 'app/core/utils/types';

import { ElasticsearchOptions, Interval } from '../types';

const indexPatternTypes: Array<SelectableValue<'none' | Interval>> = [
  { label: 'No pattern', value: 'none' },
  { label: 'Hourly', value: 'Hourly', example: '[logstash-]YYYY.MM.DD.HH' },
  { label: 'Daily', value: 'Daily', example: '[logstash-]YYYY.MM.DD' },
  { label: 'Weekly', value: 'Weekly', example: '[logstash-]GGGG.WW' },
  { label: 'Monthly', value: 'Monthly', example: '[logstash-]YYYY.MM' },
  { label: 'Yearly', value: 'Yearly', example: '[logstash-]YYYY' },
];

const esVersions: SelectableValue[] = [
  { label: '7.10+', value: '7.10.0' },
  {
    label: '8.0+',
    value: '8.0.0',
    description: 'support for Elasticsearch 8 is currently experimental',
  },
];

type Props = {
  value: DataSourceSettings<ElasticsearchOptions>;
  onChange: (value: DataSourceSettings<ElasticsearchOptions>) => void;
};
export const ElasticDetails = ({ value, onChange }: Props) => {
  const currentVersion = esVersions.find((version) => version.value === value.jsonData.esVersion);
  const customOption =
    !currentVersion && valid(value.jsonData.esVersion)
      ? {
          label: value.jsonData.esVersion,
          value: value.jsonData.esVersion,
        }
      : undefined;
  return (
    <>
      <FieldSet label="Elasticsearch details">
        <InlineField label="Index name" labelWidth={26}>
          <Input
            id="es_config_indexName"
            value={value.database || ''}
            onChange={changeHandler('database', value, onChange)}
            width={24}
            placeholder="es-index-name"
            required
          />
        </InlineField>

        <InlineField label="Pattern" labelWidth={26}>
          <Select
            inputId="es_config_indexPattern"
            value={indexPatternTypes.find(
              (pattern) => pattern.value === (value.jsonData.interval === undefined ? 'none' : value.jsonData.interval)
            )}
            options={indexPatternTypes}
            onChange={intervalHandler(value, onChange)}
            width={24}
          />
        </InlineField>

        <InlineField label="Time field name" labelWidth={26}>
          <Input
            id="es_config_timeField"
            value={value.jsonData.timeField || ''}
            onChange={jsonDataChangeHandler('timeField', value, onChange)}
            width={24}
            placeholder="@timestamp"
            required
          />
        </InlineField>

        <InlineField label="ElasticSearch version" labelWidth={26}>
          <Select
            inputId="es_config_version"
            options={[customOption, ...esVersions].filter(isTruthy)}
            onChange={(option) => {
              const maxConcurrentShardRequests = getMaxConcurrenShardRequestOrDefault(
                value.jsonData.maxConcurrentShardRequests
              );
              onChange({
                ...value,
                jsonData: {
                  ...value.jsonData,
                  esVersion: option.value!,
                  maxConcurrentShardRequests,
                },
              });
            }}
            value={currentVersion || customOption}
            width={24}
          />
        </InlineField>

        <InlineField label="Max concurrent Shard Requests" labelWidth={26}>
          <Input
            id="es_config_shardRequests"
            value={value.jsonData.maxConcurrentShardRequests || ''}
            onChange={jsonDataChangeHandler('maxConcurrentShardRequests', value, onChange)}
            width={24}
          />
        </InlineField>

        <InlineField
          label="Min time interval"
          labelWidth={26}
          tooltip={
            <>
              A lower limit for the auto group by time interval. Recommended to be set to write frequency, for example{' '}
              <code>1m</code> if your data is written every minute.
            </>
          }
          error="Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s"
          invalid={!!value.jsonData.timeInterval && !/^\d+(ms|[Mwdhmsy])$/.test(value.jsonData.timeInterval)}
        >
          <Input
            id="es_config_minTimeInterval"
            value={value.jsonData.timeInterval || ''}
            onChange={jsonDataChangeHandler('timeInterval', value, onChange)}
            width={24}
            placeholder="10s"
          />
        </InlineField>

        <InlineField label="X-Pack enabled" labelWidth={26}>
          <InlineSwitch
            id="es_config_xpackEnabled"
            checked={value.jsonData.xpack || false}
            onChange={jsonDataSwitchChangeHandler('xpack', value, onChange)}
          />
        </InlineField>

        {value.jsonData.xpack && (
          <InlineField label="Include Frozen Indices" labelWidth={26}>
            <InlineSwitch
              id="es_config_frozenIndices"
              checked={value.jsonData.includeFrozen ?? false}
              onChange={jsonDataSwitchChangeHandler('includeFrozen', value, onChange)}
            />
          </InlineField>
        )}
      </FieldSet>
    </>
  );
};

// TODO: Use change handlers from @grafana/data
const changeHandler =
  (key: keyof DataSourceSettings<ElasticsearchOptions>, value: Props['value'], onChange: Props['onChange']) =>
  (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({
      ...value,
      [key]: event.currentTarget.value,
    });
  };

// TODO: Use change handlers from @grafana/data
const jsonDataChangeHandler =
  (key: keyof ElasticsearchOptions, value: Props['value'], onChange: Props['onChange']) =>
  (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({
      ...value,
      jsonData: {
        ...value.jsonData,
        [key]: event.currentTarget.value,
      },
    });
  };

const jsonDataSwitchChangeHandler =
  (key: keyof ElasticsearchOptions, value: Props['value'], onChange: Props['onChange']) =>
  (event: React.SyntheticEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      jsonData: {
        ...value.jsonData,
        [key]: event.currentTarget.checked,
      },
    });
  };

const intervalHandler =
  (value: Props['value'], onChange: Props['onChange']) => (option: SelectableValue<Interval | 'none'>) => {
    const { database } = value;
    // If option value is undefined it will send its label instead so we have to convert made up value to undefined here.
    const newInterval = option.value === 'none' ? undefined : option.value;

    if (!database || database.length === 0 || database.startsWith('[logstash-]')) {
      let newDatabase = '';

      if (newInterval !== undefined) {
        const pattern = indexPatternTypes.find((pattern) => pattern.value === newInterval);

        if (pattern) {
          newDatabase = pattern.example ?? '';
        }
      }

      onChange({
        ...value,
        database: newDatabase,
        jsonData: {
          ...value.jsonData,
          interval: newInterval,
        },
      });
    } else {
      onChange({
        ...value,
        jsonData: {
          ...value.jsonData,
          interval: newInterval,
        },
      });
    }
  };

function getMaxConcurrenShardRequestOrDefault(maxConcurrentShardRequests: number | undefined): number {
  if (maxConcurrentShardRequests === 256) {
    return 5;
  }

  return maxConcurrentShardRequests || defaultMaxConcurrentShardRequests();
}

export function defaultMaxConcurrentShardRequests() {
  return 5;
}
