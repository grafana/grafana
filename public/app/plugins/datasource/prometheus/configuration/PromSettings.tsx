import React, { SyntheticEvent } from 'react';
import { EventsWithValidation, FormField, FormLabel, Input, regexValidation, Select } from '@grafana/ui';
import { DataSourceSettings, SelectableValue } from '@grafana/data';
import { PromOptions } from '../types';

const httpOptions = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
];

type Props = {
  value: DataSourceSettings<PromOptions>;
  onChange: (value: DataSourceSettings<PromOptions>) => void;
};

export const PromSettings = (props: Props) => {
  const { value, onChange } = props;

  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              label="Scrape interval"
              labelWidth={13}
              placeholder="15s"
              inputEl={
                <Input
                  className="width-6"
                  value={value.jsonData.timeInterval}
                  spellCheck={false}
                  onChange={onChangeHandler('timeInterval', value, onChange)}
                  validationEvents={promSettingsValidationEvents}
                />
              }
              tooltip="Set this to the typical scrape and evaluation interval configured in Prometheus. Defaults to 15s."
            />
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              label="Query timeout"
              labelWidth={13}
              inputEl={
                <Input
                  className="width-6"
                  value={value.jsonData.queryTimeout}
                  onChange={onChangeHandler('queryTimeout', value, onChange)}
                  spellCheck={false}
                  placeholder="60s"
                  validationEvents={promSettingsValidationEvents}
                />
              }
              tooltip="Set the Prometheus query timeout."
            />
          </div>
        </div>
        <div className="gf-form">
          <FormLabel
            width={13}
            tooltip="Specify the HTTP Method to query Prometheus. (POST is only available in Prometheus >= v2.1.0)"
          >
            HTTP Method
          </FormLabel>
          <Select
            options={httpOptions}
            value={httpOptions.find(o => o.value === value.jsonData.httpMethod)}
            onChange={onChangeHandler('httpMethod', value, onChange)}
            width={7}
          />
        </div>
      </div>
      <h3 className="page-heading">Misc</h3>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form max-width-30">
            <FormField
              label="Custom query parameters"
              labelWidth={14}
              tooltip="Add Custom parameters to Prometheus or Thanos queries."
              inputEl={
                <Input
                  className="width-25"
                  value={value.jsonData.customQueryParameters}
                  onChange={onChangeHandler('customQueryParameters', value, onChange)}
                  spellCheck={false}
                  placeholder="Example: max_source_resolution=5m&timeout=10"
                />
              }
            />
          </div>
        </div>
      </div>
    </>
  );
};

export const promSettingsValidationEvents = {
  [EventsWithValidation.onBlur]: [
    regexValidation(
      /^$|^\d+(ms|[Mwdhmsy])$/,
      'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s'
    ),
  ],
};

export const getValueFromEventItem = (eventItem: SyntheticEvent<HTMLInputElement> | SelectableValue<string>) => {
  if (!eventItem) {
    return '';
  }

  if (eventItem.hasOwnProperty('currentTarget')) {
    return eventItem.currentTarget.value;
  }

  return (eventItem as SelectableValue<string>).value;
};

const onChangeHandler = (key: keyof PromOptions, value: Props['value'], onChange: Props['onChange']) => (
  eventItem: SyntheticEvent<HTMLInputElement> | SelectableValue<string>
) => {
  onChange({
    ...value,
    jsonData: {
      ...value.jsonData,
      [key]: getValueFromEventItem(eventItem),
    },
  });
};
