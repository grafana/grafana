import React, { useEffect } from 'react';
import {
  Button,
  DataSourceHttpSettings,
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  EventsWithValidation,
  FormField,
  Input,
  regexValidation,
} from '@grafana/ui';
import { DerivedFieldConfig, ElasticsearchOptions } from '../types';

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

export type Props = DataSourcePluginOptionsEditorProps<ElasticsearchOptions>;
export const ConfigEditor = (props: Props) => {
  const { options, onOptionsChange } = props;

  // Apply some defaults on initial render
  useEffect(() => {
    const esVersion = options.jsonData.esVersion || 5;
    const defaultMaxConcurrentShardRequests = esVersion >= 70 ? 5 : 256;
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        timeField: options.jsonData.timeField || '@timestamp',
        esVersion,
        maxConcurrentShardRequests: options.jsonData.maxConcurrentShardRequests || defaultMaxConcurrentShardRequests,
        logMessageField: options.jsonData.logMessageField || '',
        logLevelField: options.jsonData.logLevelField || '',
      },
    });
  }, []);

  // Apply some default to database field when interval changes and database is empty.
  useEffect(() => {
    if (!options.database || options.database.length === 0 || options.database.startsWith('[logstash-]')) {
      const pattern = indexPatternTypes.find(pattern => pattern.value === options.jsonData.interval);
      onOptionsChange({
        ...options,
        database: pattern.example || 'es-index-name',
      });
    }
  }, [options.database, options.jsonData.interval]);

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl={'http://localhost:3100'}
        dataSourceConfig={options}
        showAccessOptions={true}
        onChange={onOptionsChange}
      />

      <Details value={options} onChange={onOptionsChange} />

      <Logs
        value={options.jsonData}
        onChange={newValue =>
          onOptionsChange({
            ...options,
            jsonData: newValue,
          })
        }
      />

      <DerivedFields
        value={options.jsonData.derivedFields}
        onChange={newDerivedFields => {
          onOptionsChange({
            ...options,
            jsonData: {
              ...options.jsonData,
              derivedFields: newDerivedFields,
            },
          });
        }}
      />
    </>
  );
};

type DetailsProps = {
  value: DataSourceSettings<ElasticsearchOptions>;
  onChange: (value: DataSourceSettings<ElasticsearchOptions>) => void;
};
const Details = (props: DetailsProps) => {
  const { value, onChange } = props;

  const changeHandler = (key: keyof DataSourceSettings<ElasticsearchOptions>) => (
    event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    onChange({
      ...value,
      [key]: event.currentTarget.value,
    });
  };

  const jsonDataChangeHandler = (key: keyof ElasticsearchOptions) => (
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

  return (
    <>
      <h3 className="page-heading">Elasticsearch details</h3>

      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form max-width-25">
            <FormField
              labelWidth={10}
              inputWidth={12}
              label="Index name"
              value={value.database || ''}
              onChange={changeHandler('database')}
              required
            />
          </div>

          <div className="gf-form width-14">
            <FormField
              labelWidth={10}
              label="Pattern"
              inputEl={
                <select
                  className="gf-form-input gf-size-auto"
                  value={value.jsonData.interval}
                  onChange={jsonDataChangeHandler('interval')}
                >
                  {indexPatternTypes.map(pattern => (
                    <option key={pattern.value} value={pattern.value}>
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
            label="Time field name"
            value={value.jsonData.timeField || ''}
            onChange={jsonDataChangeHandler('timeField')}
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
                  onChange={jsonDataChangeHandler('esVersion')}
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
              labelWidth={15}
              label="Max concurrent Shard Requests"
              value={value.jsonData.maxConcurrentShardRequests || ''}
              onChange={jsonDataChangeHandler('maxConcurrentShardRequests')}
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
                  value={value.jsonData.timeInterval || ''}
                  onChange={jsonDataChangeHandler('timeInterval')}
                  placeholder="10s"
                  validationEvents={{ [EventsWithValidation.onBlur]: [regexValidation(/^\d+(ms|[Mwdhmsy])$/)] }}
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

type LogsProps = {
  value: ElasticsearchOptions;
  onChange: (value: ElasticsearchOptions) => void;
};
const Logs = (props: LogsProps) => {
  const { value, onChange } = props;
  const changeHandler = (key: keyof ElasticsearchOptions) => (
    event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    onChange({
      ...value,
      [key]: event.currentTarget.value,
    });
  };

  return (
    <>
      <h3 className="page-heading">Logs</h3>

      <div className="gf-form-group">
        <div className="gf-form max-width-30">
          <FormField
            labelWidth={11}
            label="Message field name"
            value={value.logMessageField}
            onChange={changeHandler('logMessageField')}
            placeholder="_source"
          />
        </div>
        <div className="gf-form max-width-30">
          <FormField
            labelWidth={11}
            label="Level field name"
            value={value.logLevelField}
            onChange={changeHandler('logLevelField')}
          />
        </div>
      </div>
    </>
  );
};

type DerivedFieldsProps = {
  value: DerivedFieldConfig[];
  onChange: (value: DerivedFieldConfig[]) => void;
};
const DerivedFields = (props: DerivedFieldsProps) => {
  const { value, onChange } = props;
  return (
    <>
      <h3 className="page-heading">Derived fields</h3>

      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            {value &&
              value.map((field, index) => {
                return (
                  <DerivedField
                    key={index}
                    value={field}
                    onChange={newField => {
                      const newDerivedFields = [...value];
                      newDerivedFields.splice(index, 1, newField);
                      onChange(newDerivedFields);
                    }}
                  />
                );
              })}
            <div>
              <Button
                variant={'secondary'}
                onClick={event => {
                  event.preventDefault();
                  const newDerivedFields = [...(value || []), { label: '', key: '', template: '' }];
                  onChange(newDerivedFields);
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

type DerivedFieldProps = {
  value: DerivedFieldConfig;
  onChange: (value: DerivedFieldConfig) => void;
};
const DerivedField = (props: DerivedFieldProps) => {
  const { value, onChange } = props;
  return (
    <>
      <FormField
        label="Label"
        value={value.label}
        onChange={event =>
          onChange({
            ...value,
            label: event.currentTarget.value,
          })
        }
      />

      <FormField
        label="Key"
        value={value.key}
        onChange={event =>
          onChange({
            ...value,
            key: event.currentTarget.value,
          })
        }
      />

      <FormField
        label="Template"
        value={value.template}
        onChange={event =>
          onChange({
            ...value,
            template: event.currentTarget.value,
          })
        }
      />
    </>
  );
};
