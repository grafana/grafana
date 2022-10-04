import React, { SyntheticEvent } from 'react';
import semver from 'semver/preload';

import {
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  onUpdateDatasourceJsonDataOptionChecked,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime/src';
import {
  EventsWithValidation,
  InlineField,
  InlineFormLabel,
  InlineSwitch,
  LegacyForms,
  regexValidation,
} from '@grafana/ui';

import { PromApplication, PromBuildInfoResponse } from '../../../../types/unified-alerting-dto';
import { PromOptions } from '../types';

import { ExemplarsSettings } from './ExemplarsSettings';
import { PromFlavorVersions } from './PromFlavorVersions';

const { Select, Input, FormField } = LegacyForms;

const httpOptions = [
  { value: 'POST', label: 'POST' },
  { value: 'GET', label: 'GET' },
];

const prometheusFlavorSelectItems: Array<{ value: PromApplication; label: PromApplication }> = [
  { value: PromApplication.Prometheus, label: PromApplication.Prometheus },
  { value: PromApplication.Cortex, label: PromApplication.Cortex },
  { value: PromApplication.Mimir, label: PromApplication.Mimir },
  { value: PromApplication.Thanos, label: PromApplication.Thanos },
];

type Props = Pick<DataSourcePluginOptionsEditorProps<PromOptions>, 'options' | 'onOptionsChange'>;

/**
 * Returns the closest version to what the user provided that we have in our PromFlavorVersions for the currently selected flavor
 * Bugs: It will only reject versions that are a major release apart, so Mimir 2.x might get selected for Prometheus 2.8 if the user selects an incorrect flavor
 * Advantages: We don't need to maintain a list of every possible version for each release
 *
 * This function will return the closest version from PromFlavorVersions that is equal or lower to the version argument,
 * unless the versions are a major release apart.
 *
 * @param version
 * @param flavor
 */
const getVersionString = (version: string, flavor?: string): string | undefined => {
  if (!flavor || !PromFlavorVersions[flavor]) {
    return;
  }
  const flavorVersionValues = PromFlavorVersions[flavor];

  // As long as it's assured we're using versions which are sorted, we could just filter out the values greater than the target version, and then check the last element in the array
  const versionsLessThanOrEqual = flavorVersionValues
    ?.filter((el) => !!el.value && semver.lte(el.value, version))
    .map((el) => el.value);

  const closestVersion = versionsLessThanOrEqual[versionsLessThanOrEqual.length - 1];

  if (closestVersion) {
    const differenceBetweenActualAndClosest = semver.diff(closestVersion, version);

    if (['patch', 'prepatch', 'prerelease', null].includes(differenceBetweenActualAndClosest)) {
      return closestVersion;
    }
  }

  return;
};

const setPrometheusVersion = (
  options: DataSourceSettings<PromOptions>,
  onOptionsChange: (options: DataSourceSettings<PromOptions>) => void
) => {
  getBackendSrv()
    .get(`/api/datasources/${options.id}/resources/version-detect`)
    .then((rawResponse: PromBuildInfoResponse) => {
      if (rawResponse.data?.version && semver.valid(rawResponse.data?.version)) {
        onOptionsChange({
          ...options,
          jsonData: {
            ...options.jsonData,
            prometheusVersion: getVersionString(rawResponse.data?.version, options.jsonData.prometheusFlavor),
          },
        });
      } else {
        // show UI to prompt manual population?
        console.warn('Error fetching version from buildinfo API, user must manually select version!');
      }
    })
    .catch((error) => {
      // show UI to prompt manual population?
      console.warn('Error fetching version from buildinfo API, user must manually select version!', error);
    });
};

export const PromSettings = (props: Props) => {
  const { options, onOptionsChange } = props;

  // We are explicitly adding httpMethod so it is correctly displayed in dropdown. This way, it is more predictable for users.
  if (!options.jsonData.httpMethod) {
    options.jsonData.httpMethod = 'POST';
  }

  return (
    <>
      <div className="gf-form-group">
        {/* Scrape interval */}
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
        {/* Query Timeout */}
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
        {/* HTTP Method */}
        <div className="gf-form">
          <InlineFormLabel
            width={13}
            tooltip="You can use either POST or GET HTTP method to query your Prometheus data source. POST is the recommended method as it allows bigger queries. Change this to GET if you have a Prometheus version older than 2.1 or if POST requests are restricted in your network."
          >
            HTTP Method
          </InlineFormLabel>
          <Select
            aria-label="Select HTTP method"
            options={httpOptions}
            value={httpOptions.find((o) => o.value === options.jsonData.httpMethod)}
            onChange={onChangeHandler('httpMethod', options, onOptionsChange)}
            width={14}
          />
        </div>
      </div>

      <h3 className="page-heading">Prometheus</h3>
      <div className="gf-form-group">
        <div className="gf-form">
          <div className="gf-form">
            <FormField
              label="Prometheus Flavor"
              labelWidth={13}
              inputEl={
                <Select
                  aria-label="Prometheus Flavor"
                  options={prometheusFlavorSelectItems}
                  value={prometheusFlavorSelectItems.find((o) => o.value === options.jsonData.prometheusFlavor)}
                  onChange={onChangeHandler(
                    'prometheusFlavor',
                    {
                      ...options,
                      jsonData: { ...options.jsonData, prometheusVersion: undefined },
                    },
                    (options) => {
                      // Check buildinfo api and set default version if we can
                      setPrometheusVersion(options, onOptionsChange);
                      return onOptionsChange({
                        ...options,
                        jsonData: { ...options.jsonData, prometheusVersion: undefined },
                      });
                    }
                  )}
                  width={20}
                />
              }
              tooltip="Set this to the typical scrape and evaluation interval configured in Prometheus. Defaults to 15s."
            />
          </div>
        </div>
        <div className="gf-form">
          {options.jsonData.prometheusFlavor && (
            <div className="gf-form">
              <FormField
                label={`${options.jsonData.prometheusFlavor} Version`}
                labelWidth={13}
                inputEl={
                  <Select
                    aria-label={`${options.jsonData.prometheusFlavor} Flavor`}
                    options={PromFlavorVersions[options.jsonData.prometheusFlavor]}
                    value={PromFlavorVersions[options.jsonData.prometheusFlavor]?.find(
                      (o) => o.value === options.jsonData.prometheusVersion
                    )}
                    onChange={onChangeHandler('prometheusVersion', options, onOptionsChange)}
                    width={20}
                  />
                }
                tooltip={`Use this to set the version of your ${options.jsonData.prometheusFlavor} instance`}
              />
            </div>
          )}
        </div>
      </div>

      <h3 className="page-heading">Misc</h3>
      <div className="gf-form-group">
        <div className="gf-form">
          <InlineField
            labelWidth={28}
            label="Disable metrics lookup"
            tooltip="Checking this option will disable the metrics chooser and metric/label support in the query field's autocomplete. This helps if you have performance issues with bigger Prometheus instances."
          >
            <InlineSwitch
              value={options.jsonData.disableMetricsLookup ?? false}
              onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'disableMetricsLookup')}
            />
          </InlineField>
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

const onChangeHandler =
  (key: keyof PromOptions, options: Props['options'], onOptionsChange: Props['onOptionsChange']) =>
  (eventItem: SyntheticEvent<HTMLInputElement> | SelectableValue<string>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        [key]: getValueFromEventItem(eventItem),
      },
    });
  };
