import React, { SyntheticEvent } from 'react';
import semver from 'semver/preload';

import {
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings as DataSourceSettingsType,
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
  Select,
} from '@grafana/ui';

import { useUpdateDatasource } from '../../../../features/datasources/state';
import { PromApplication, PromBuildInfoResponse } from '../../../../types/unified-alerting-dto';
import { PromOptions } from '../types';

import { ExemplarsSettings } from './ExemplarsSettings';
import { PromFlavorVersions } from './PromFlavorVersions';

const { Input, FormField } = LegacyForms;

const httpOptions = [
  { value: 'POST', label: 'POST' },
  { value: 'GET', label: 'GET' },
];

type PrometheusSelectItemsType = Array<{ value: PromApplication; label: PromApplication }>;

const prometheusFlavorSelectItems: PrometheusSelectItemsType = [
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

    // Only return versions if the target is close to the actual.
    if (['patch', 'prepatch', 'prerelease', null].includes(differenceBetweenActualAndClosest)) {
      return closestVersion;
    }
  }

  return;
};

const unableToDeterminePrometheusVersion = (error?: Error): void => {
  console.warn('Error fetching version from buildinfo API, must manually select version!', error);
};

/**
 * I don't like the daisy chain of network requests, and that we have to save on behalf of the user, but currently
 * the backend doesn't allow for the prometheus client url to be passed in from the frontend, so we currently need to save it
 * to the database before consumption.
 *
 * Since the prometheus version fields are below the url field, we can expect users to populate this field before
 * hitting save and test at the bottom of the page. For this case we need to save the current fields before calling the
 * resource to auto-detect the version.
 *
 * @param options
 * @param onOptionsChange
 * @param onUpdate
 */
const setPrometheusVersion = (
  options: DataSourceSettingsType<PromOptions>,
  onOptionsChange: (options: DataSourceSettingsType<PromOptions>) => void,
  onUpdate: (dataSource: DataSourceSettingsType<PromOptions>) => Promise<DataSourceSettingsType<PromOptions>>
) => {
  // This will save the current state of the form, as the url is needed for this API call to function
  onUpdate(options)
    .then((updatedOptions) => {
      getBackendSrv()
        .get(`/api/datasources/${updatedOptions.id}/resources/version-detect`)
        .then((rawResponse: PromBuildInfoResponse) => {
          const rawVersionStringFromApi = rawResponse.data?.version ?? '';
          if (rawVersionStringFromApi && semver.valid(rawVersionStringFromApi)) {
            const parsedVersion = getVersionString(rawVersionStringFromApi, updatedOptions.jsonData.prometheusType);
            // If we got a successful response, let's update the backend with the version right away if it's new
            if (parsedVersion) {
              onUpdate({
                ...updatedOptions,
                jsonData: {
                  ...updatedOptions.jsonData,
                  prometheusVersion: parsedVersion,
                },
              }).then((updatedUpdatedOptions) => {
                onOptionsChange(updatedUpdatedOptions);
              });
            }
          } else {
            unableToDeterminePrometheusVersion();
          }
        });
    })
    .catch((error) => {
      unableToDeterminePrometheusVersion(error);
    });
};

export const PromSettings = (props: Props) => {
  const { options, onOptionsChange } = props;

  // This update call is typed as void, but it returns a response which we need
  const onUpdate = useUpdateDatasource();

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
            HTTP method
          </InlineFormLabel>
          <Select
            aria-label="Select HTTP method"
            options={httpOptions}
            value={httpOptions.find((o) => o.value === options.jsonData.httpMethod)}
            onChange={onChangeHandler('httpMethod', options, onOptionsChange)}
            className="width-6"
          />
        </div>
      </div>

      <h3 className="page-heading">Type and version</h3>
      {!options.jsonData.prometheusType && !options.jsonData.prometheusVersion && options.readOnly && (
        <div style={{ marginBottom: '12px' }}>
          For more information on configuring prometheus type and version in data sources, see the{' '}
          <a
            style={{ textDecoration: 'underline' }}
            href="https://grafana.com/docs/grafana/latest/administration/provisioning/"
          >
            provisioning documentation
          </a>
          .
        </div>
      )}
      <div className="gf-form-group">
        <div className="gf-form">
          <div className="gf-form">
            <FormField
              label="Prometheus type"
              labelWidth={13}
              inputEl={
                <Select
                  aria-label="Prometheus type"
                  options={prometheusFlavorSelectItems}
                  value={prometheusFlavorSelectItems.find((o) => o.value === options.jsonData.prometheusType)}
                  onChange={onChangeHandler(
                    'prometheusType',
                    {
                      ...options,
                      jsonData: { ...options.jsonData, prometheusVersion: undefined },
                    },
                    (options) => {
                      // Check buildinfo api and set default version if we can
                      setPrometheusVersion(options, onOptionsChange, onUpdate);
                      return onOptionsChange({
                        ...options,
                        jsonData: { ...options.jsonData, prometheusVersion: undefined },
                      });
                    }
                  )}
                  width={20}
                />
              }
              tooltip="Set this to the type of your prometheus database, e.g. Prometheus, Cortex, Mimir or Thanos. Changing this field will save your current settings, and attempt to detect the version."
            />
          </div>
        </div>
        <div className="gf-form">
          {options.jsonData.prometheusType && (
            <div className="gf-form">
              <FormField
                label={`${options.jsonData.prometheusType} version`}
                labelWidth={13}
                inputEl={
                  <Select
                    aria-label={`${options.jsonData.prometheusType} type`}
                    options={PromFlavorVersions[options.jsonData.prometheusType]}
                    value={PromFlavorVersions[options.jsonData.prometheusType]?.find(
                      (o) => o.value === options.jsonData.prometheusVersion
                    )}
                    onChange={onChangeHandler('prometheusVersion', options, onOptionsChange)}
                    width={20}
                  />
                }
                tooltip={`Use this to set the version of your ${options.jsonData.prometheusType} instance if it is not automatically configured.`}
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
              tooltip="Add custom parameters to all Prometheus or Thanos queries."
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
