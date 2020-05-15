import React from 'react';
import { EventsWithValidation, regexValidation, LegacyForms } from '@grafana/ui';
const { Select, Input, FormField } = LegacyForms;
import { ElasticsearchOptions } from '../types';
import { DataSourceSettings, SelectableValue } from '@grafana/data';

const indexPatternTypes = [
  { label: 'No pattern', value: 'none' },
  { label: 'Hourly', value: 'Hourly', example: '[logstash-]YYYY.MM.DD.HH' },
  { label: 'Daily', value: 'Daily', example: '[logstash-]YYYY.MM.DD' },
  { label: 'Weekly', value: 'Weekly', example: '[logstash-]GGGG.WW' },
  { label: 'Monthly', value: 'Monthly', example: '[logstash-]YYYY.MM' },
  { label: 'Yearly', value: 'Yearly', example: '[logstash-]YYYY' },
];

const esVersions = [
  { label: '2.x', value: 2 },
  { label: '5.x', value: 5 },
  { label: '5.6+', value: 56 },
  { label: '6.0+', value: 60 },
  { label: '7.0+', value: 70 },
];

type Props = {
  value: DataSourceSettings<ElasticsearchOptions>;
  onChange: (value: DataSourceSettings<ElasticsearchOptions>) => void;
};
export const ElasticDetails = (props: Props) => {
  const { value, onChange } = props;

  return (
    <>
      <h3 className="page-heading">Elasticsearch details</h3>

      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form max-width-25">
            <FormField
              labelWidth={10}
              inputWidth={15}
              label="Index name"
              value={value.database || ''}
              onChange={changeHandler('database', value, onChange)}
              placeholder={'es-index-name'}
              required
            />
          </div>

          <div className="gf-form width-14">
            <FormField
              labelWidth={10}
              label="Pattern"
              inputEl={
                <Select
                  options={indexPatternTypes}
                  onChange={intervalHandler(value, onChange)}
                  value={indexPatternTypes.find(
                    pattern =>
                      pattern.value === (value.jsonData.interval === undefined ? 'none' : value.jsonData.interval)
                  )}
                />
              }
            />
          </div>
        </div>

        <div className="gf-form max-width-25">
          <FormField
            labelWidth={10}
            inputWidth={15}
            label="Time field name"
            value={value.jsonData.timeField || ''}
            onChange={jsonDataChangeHandler('timeField', value, onChange)}
            required
          />
        </div>

        <div className="gf-form">
          <span className="gf-form-select-wrapper">
            <FormField
              labelWidth={10}
              label="Version"
              inputEl={
                <Select
                  options={esVersions}
                  onChange={option => {
                    const maxConcurrentShardRequests = getMaxConcurrenShardRequestOrDefault(
                      value.jsonData.maxConcurrentShardRequests,
                      option.value
                    );
                    onChange({
                      ...value,
                      jsonData: {
                        ...value.jsonData,
                        esVersion: option.value,
                        maxConcurrentShardRequests,
                      },
                    });
                  }}
                  value={esVersions.find(version => version.value === value.jsonData.esVersion)}
                />
              }
            />
          </span>
        </div>
        {value.jsonData.esVersion >= 56 && (
          <div className="gf-form max-width-30">
            <FormField
              aria-label={'Max concurrent Shard Requests input'}
              labelWidth={15}
              label="Max concurrent Shard Requests"
              value={value.jsonData.maxConcurrentShardRequests || ''}
              onChange={jsonDataChangeHandler('maxConcurrentShardRequests', value, onChange)}
            />
          </div>
        )}
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              labelWidth={10}
              label="Min time interval"
              inputEl={
                <Input
                  className={'width-6'}
                  value={value.jsonData.timeInterval || ''}
                  onChange={jsonDataChangeHandler('timeInterval', value, onChange)}
                  placeholder="10s"
                  validationEvents={{
                    [EventsWithValidation.onBlur]: [
                      regexValidation(
                        /^\d+(ms|[Mwdhmsy])$/,
                        'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s'
                      ),
                    ],
                  }}
                />
              }
              tooltip={
                <>
                  A lower limit for the auto group by time interval. Recommended to be set to write frequency, for
                  example <code>1m</code> if your data is written every minute.
                </>
              }
            />
          </div>
        </div>
      </div>
    </>
  );
};

const changeHandler = (
  key: keyof DataSourceSettings<ElasticsearchOptions>,
  value: Props['value'],
  onChange: Props['onChange']
) => (event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) => {
  onChange({
    ...value,
    [key]: event.currentTarget.value,
  });
};

const jsonDataChangeHandler = (key: keyof ElasticsearchOptions, value: Props['value'], onChange: Props['onChange']) => (
  event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
) => {
  onChange({
    ...value,
    jsonData: {
      ...value.jsonData,
      [key]: event.currentTarget.value,
    },
  });
};

const intervalHandler = (value: Props['value'], onChange: Props['onChange']) => (option: SelectableValue<string>) => {
  const { database } = value;
  // If option value is undefined it will send its label instead so we have to convert made up value to undefined here.
  const newInterval = option.value === 'none' ? undefined : option.value;

  if (!database || database.length === 0 || database.startsWith('[logstash-]')) {
    let newDatabase = '';
    if (newInterval !== undefined) {
      const pattern = indexPatternTypes.find(pattern => pattern.value === newInterval);
      if (pattern) {
        newDatabase = pattern.example;
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

function getMaxConcurrenShardRequestOrDefault(maxConcurrentShardRequests: number, version: number): number {
  if (maxConcurrentShardRequests === 5 && version < 70) {
    return 256;
  }

  if (maxConcurrentShardRequests === 256 && version >= 70) {
    return 5;
  }

  return maxConcurrentShardRequests || defaultMaxConcurrentShardRequests(version);
}

export function defaultMaxConcurrentShardRequests(version: number) {
  return version >= 70 ? 5 : 256;
}
