import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOptionChecked,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { EventsWithValidation, InlineFormLabel, LegacyForms, regexValidation } from '@grafana/ui';
import React, { SyntheticEvent } from 'react';
import { PromOptions } from '../types';
import { ExemplarsSettings } from './ExemplarsSettings';
import { PrometheusFlavour } from '../flavour_provider';

export const DOWNSAMPLE_RAW = 0;
export const DOWNSAMPLE_5M = 60 * 5;
export const DOWNSAMPLE_1H = 60 * 60;

const { Select, Input, FormField, Switch } = LegacyForms;

const httpOptions = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
];

const flavourOptions = [
  { value: PrometheusFlavour.Prometheus, label: PrometheusFlavour.Prometheus },
  { value: PrometheusFlavour.Thanos, label: PrometheusFlavour.Thanos },
];

type Props = Pick<DataSourcePluginOptionsEditorProps<PromOptions>, 'options' | 'onOptionsChange'>;

export const PromSettings = (props: Props) => {
  const { options, onOptionsChange } = props;
  let retentionPolicies: { [index: string]: any } = {};
  if (options.jsonData.retentionPolicies === '' || options.jsonData.retentionPolicies === undefined) {
    retentionPolicies[DOWNSAMPLE_RAW.toString(10)] = '0d';
  } else {
    retentionPolicies = JSON.parse(options.jsonData.retentionPolicies);
  }
  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              label="Scrape interval"
              labelWidth={13}
              inputEl={
                <Input
                  className="width-6"
                  value={options.jsonData.timeInterval}
                  spellCheck={false}
                  placeholder="15s"
                  onChange={onChangeHandler('timeInterval', options, onOptionsChange)}
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
                  value={options.jsonData.queryTimeout}
                  onChange={onChangeHandler('queryTimeout', options, onOptionsChange)}
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
          <InlineFormLabel
            width={13}
            tooltip="Specify the HTTP Method to query Prometheus. (POST is only available in Prometheus >= v2.1.0)"
          >
            HTTP Method
          </InlineFormLabel>
          <Select
            options={httpOptions}
            value={httpOptions.find((o) => o.value === options.jsonData.httpMethod)}
            onChange={onChangeHandler('httpMethod', options, onOptionsChange)}
            width={7}
          />
        </div>
      </div>
      <h3 className="page-heading">Misc</h3>
      <div className="gf-form-group">
        <div className="gf-form">
          <Switch
            checked={options.jsonData.disableMetricsLookup ?? false}
            label="Disable metrics lookup"
            labelClass="width-14"
            onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'disableMetricsLookup')}
            tooltip="Checking this option will disable the metrics chooser and metric/label support in the query field's autocomplete. This helps if you have performance issues with bigger Prometheus instances."
          />
        </div>
        <div className="gf-form-inline">
          <div className="gf-form max-width-30">
            <FormField
              label="Custom query parameters"
              labelWidth={14}
              tooltip="Add Custom parameters to all Prometheus or Thanos queries."
              inputEl={
                <Input
                  className="width-25"
                  value={options.jsonData.customQueryParameters}
                  onChange={onChangeHandler('customQueryParameters', options, onOptionsChange)}
                  spellCheck={false}
                  placeholder="Example: max_source_resolution=5m&timeout=10"
                />
              }
            />
          </div>
        </div>
        <div className="gf-form">
          <InlineFormLabel width={14} tooltip="Data source backend.">
            Flavour
          </InlineFormLabel>
          <Select
            options={flavourOptions}
            value={flavourOptions.find((o) => o.value === options.jsonData.flavour)}
            onChange={onChangeHandler('flavour', options, onOptionsChange)}
            width={7}
          />
        </div>
      </div>
      <ExemplarsSettings
        options={options.jsonData.exemplarTraceIdDestinations}
        onChange={(exemplarOptions) =>
          updateDatasourcePluginJsonDataOption(
            { onOptionsChange, options },
            'exemplarTraceIdDestinations',
            exemplarOptions
          )
        }
      />
      {options.jsonData.flavour === PrometheusFlavour.Thanos && (
        <>
          <h3 className="page-heading">Thanos downsampling and retention</h3>
          <div className="gf-form-group">
            <div className="gf-form-inline">
              <div className="gf-form max-width-30">
                <FormField
                  label="Retention for raw resolution"
                  labelWidth={14}
                  tooltip="Raw data retention. 0 for unlimited."
                  inputEl={
                    <Input
                      className="width-25"
                      value={retentionPolicies[DOWNSAMPLE_RAW.toString(10)] || '0s'}
                      onChange={onRetentionChangeHandler(
                        DOWNSAMPLE_RAW.toString(10),
                        options,
                        onOptionsChange,
                        retentionPolicies
                      )}
                      validationEvents={promSettingsValidationEvents}
                      spellCheck={false}
                      placeholder="0"
                    />
                  }
                />
              </div>
            </div>
            <div className="gf-form-inline">
              <div className="gf-form max-width-30">
                <FormField
                  label="Retention for 5 minutes resolution"
                  labelWidth={14}
                  tooltip="Thanos 5 minutes downsampled data retention. 0 for unlimited."
                  inputEl={
                    <Input
                      className="width-25"
                      value={retentionPolicies[DOWNSAMPLE_5M.toString(10)] || '0s'}
                      onChange={onRetentionChangeHandler(
                        DOWNSAMPLE_5M.toString(10),
                        options,
                        onOptionsChange,
                        retentionPolicies
                      )}
                      validationEvents={promSettingsValidationEvents}
                      spellCheck={false}
                      placeholder="0"
                    />
                  }
                />
              </div>
            </div>
            <div className="gf-form-inline">
              <div className="gf-form max-width-30">
                <FormField
                  label="Retention for 1 hour resolution"
                  labelWidth={14}
                  tooltip="Thanos 1 hour downsampled data retention. 0 for unlimited."
                  inputEl={
                    <Input
                      className="width-25"
                      value={retentionPolicies[DOWNSAMPLE_1H.toString(10)] || '0s'}
                      onChange={onRetentionChangeHandler(
                        DOWNSAMPLE_1H.toString(10),
                        options,
                        onOptionsChange,
                        retentionPolicies
                      )}
                      validationEvents={promSettingsValidationEvents}
                      spellCheck={false}
                      placeholder="0"
                    />
                  }
                />
              </div>
            </div>
          </div>
        </>
      )}
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

const onChangeHandler = (
  key: keyof PromOptions,
  options: Props['options'],
  onOptionsChange: Props['onOptionsChange']
) => (eventItem: SyntheticEvent<HTMLInputElement> | SelectableValue<string>) => {
  onOptionsChange({
    ...options,
    jsonData: {
      ...options.jsonData,
      [key]: getValueFromEventItem(eventItem),
    },
  });
};

const onRetentionChangeHandler = (
  key: string,
  options: Props['options'],
  onOptionsChange: Props['onOptionsChange'],
  policies: { [index: string]: string }
) => (eventItem: SyntheticEvent<HTMLInputElement> | SelectableValue<string>) => {
  policies[key] = eventItem.target.value;
  onOptionsChange({
    ...options,
    jsonData: {
      ...options.jsonData,
      ['retentionPolicies']: JSON.stringify(policies),
    },
  });
};
