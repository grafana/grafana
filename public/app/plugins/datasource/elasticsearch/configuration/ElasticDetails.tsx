import React from 'react';
import { DataSourceSettings, EventsWithValidation, FormField, Input, regexValidation } from '@grafana/ui';
import { ElasticsearchOptions } from '../types';

const indexPatternTypes = [
  { name: 'No pattern' },
  { name: 'Hourly', value: 'Hourly', example: '[logstash-]YYYY.MM.DD.HH' },
  { name: 'Daily', value: 'Daily', example: '[logstash-]YYYY.MM.DD' },
  { name: 'Weekly', value: 'Weekly', example: '[logstash-]GGGG.WW' },
  { name: 'Monthly', value: 'Monthly', example: '[logstash-]YYYY.MM' },
  { name: 'Yearly', value: 'Yearly', example: '[logstash-]YYYY' },
];

const esVersions = [
  { name: '2.x', value: 2 },
  { name: '5.x', value: 5 },
  { name: '5.6+', value: 56 },
  { name: '6.0+', value: 60 },
  { name: '7.0+', value: 70 },
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
                <select
                  aria-label={'Pattern select'}
                  className="gf-form-input gf-size-auto"
                  value={value.jsonData.interval}
                  onChange={intervalHandler(value, onChange)}
                >
                  {indexPatternTypes.map(pattern => (
                    <option key={pattern.value || 'undefined'} value={pattern.value || 'none'}>
                      {pattern.name}
                    </option>
                  ))}
                </select>
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
                <select
                  className="gf-form-input gf-size-auto"
                  value={value.jsonData.esVersion}
                  onChange={jsonDataChangeHandler('esVersion', value, onChange)}
                >
                  {esVersions.map(version => (
                    <option key={version.value} value={version.value}>
                      {version.name}
                    </option>
                  ))}
                </select>
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

const intervalHandler = (value: Props['value'], onChange: Props['onChange']) => (
  event: React.SyntheticEvent<HTMLSelectElement>
) => {
  const { database } = value;
  // If option value is undefined it will send its label instead so we have to convert made up value to undefined here.
  const newInterval = event.currentTarget.value === 'none' ? undefined : event.currentTarget.value;

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
