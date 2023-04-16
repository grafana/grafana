import React, { SyntheticEvent, useState } from 'react';
import semver from 'semver/preload';

import {
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings as DataSourceSettingsType,
  onUpdateDatasourceJsonDataOptionChecked,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime/src';
import { InlineField, Input, Select, Switch, useTheme2 } from '@grafana/ui';

import config from '../../../../core/config';
import { useUpdateDatasource } from '../../../../features/datasources/state';
import { PromApplication, PromBuildInfoResponse } from '../../../../types/unified-alerting-dto';
import { QueryEditorMode } from '../querybuilder/shared/types';
import { defaultPrometheusQueryOverlapWindow } from '../querycache/QueryCache';
import { PrometheusCacheLevel, PromOptions } from '../types';

import { docsTip, overhaulStyles, PROM_CONFIG_LABEL_WIDTH, validateInput } from './ConfigEditor';
import { ExemplarsSettings } from './ExemplarsSettings';
import { PromFlavorVersions } from './PromFlavorVersions';

const httpOptions = [
  { value: 'POST', label: 'POST' },
  { value: 'GET', label: 'GET' },
];

const editorOptions = [
  { value: QueryEditorMode.Builder, label: 'Builder' },
  { value: QueryEditorMode.Code, label: 'Code' },
];

const cacheValueOptions = [
  { value: PrometheusCacheLevel.Low, label: 'Low' },
  { value: PrometheusCacheLevel.Medium, label: 'Medium' },
  { value: PrometheusCacheLevel.High, label: 'High' },
  { value: PrometheusCacheLevel.None, label: 'None' },
];

type PrometheusSelectItemsType = Array<{ value: PromApplication; label: PromApplication }>;

const prometheusFlavorSelectItems: PrometheusSelectItemsType = [
  { value: PromApplication.Prometheus, label: PromApplication.Prometheus },
  { value: PromApplication.Cortex, label: PromApplication.Cortex },
  { value: PromApplication.Mimir, label: PromApplication.Mimir },
  { value: PromApplication.Thanos, label: PromApplication.Thanos },
];

type Props = Pick<DataSourcePluginOptionsEditorProps<PromOptions>, 'options' | 'onOptionsChange'>;

export const DURATION_REGEX = /^$|^\d+(ms|[Mwdhmsy])$/;
const durationError = 'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s';
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
        .get(`/api/datasources/uid/${updatedOptions.uid}/resources/version-detect`)
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

  // We are explicitly adding httpMethod so, it is correctly displayed in dropdown.
  // This way, it is more predictable for users.
  if (!options.jsonData.httpMethod) {
    options.jsonData.httpMethod = 'POST';
  }

  const theme = useTheme2();
  const styles = overhaulStyles(theme);

  type ValidDuration = {
    timeInterval: string;
    queryTimeout: string;
    incrementalQueryOverlapWindow: string;
  };

  const [validDuration, updateValidDuration] = useState<ValidDuration>({
    timeInterval: '',
    queryTimeout: '',
    incrementalQueryOverlapWindow: '',
  });

  return (
    <>
      <h6 className="page-heading">Interval Behaviour</h6>
      <div className="gf-form-group">
        {/* Scrape interval */}
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineField
              label="Scrape interval"
              labelWidth={PROM_CONFIG_LABEL_WIDTH}
              tooltip={
                <>
                  This interval is how frequently Prometheus scrapes targets. Set this to the typical scrape and
                  evaluation interval configured in your Prometheus config file. If you set this to a greater value than
                  your Prometheus config file interval, Grafana will evaluate the data according to this interval and
                  you will see less data points. Defaults to 15s. {docsTip()}
                </>
              }
              interactive={true}
            >
              <>
                <Input
                  className="width-20"
                  value={options.jsonData.timeInterval}
                  spellCheck={false}
                  placeholder="15s"
                  onChange={onChangeHandler('timeInterval', options, onOptionsChange)}
                  onBlur={(e) => updateValidDuration({ ...validDuration, timeInterval: e.currentTarget.value })}
                  disabled={options.readOnly}
                />
                {validateInput(validDuration.timeInterval, DURATION_REGEX, durationError)}
              </>
            </InlineField>
          </div>
        </div>
        {/* Query Timeout */}
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineField
              label="Query timeout"
              labelWidth={PROM_CONFIG_LABEL_WIDTH}
              tooltip={<>Set the Prometheus query timeout. {docsTip()}</>}
              interactive={true}
            >
              <>
                <Input
                  className="width-20"
                  value={options.jsonData.queryTimeout}
                  onChange={onChangeHandler('queryTimeout', options, onOptionsChange)}
                  spellCheck={false}
                  placeholder="60s"
                  onBlur={(e) => updateValidDuration({ ...validDuration, queryTimeout: e.currentTarget.value })}
                  disabled={options.readOnly}
                />
                {validateInput(validDuration.queryTimeout, DURATION_REGEX, durationError)}
              </>
            </InlineField>
          </div>
        </div>
      </div>

      <h6 className="page-heading">Query Editor</h6>
      <div className="gf-form-group">
        <div className="gf-form">
          <InlineField
            label="Default editor"
            labelWidth={PROM_CONFIG_LABEL_WIDTH}
            tooltip={<>Set default editor option for all users of this data source. {docsTip()}</>}
            interactive={true}
          >
            <Select
              aria-label={`Default Editor (Code or Builder)`}
              options={editorOptions}
              value={
                editorOptions.find((o) => o.value === options.jsonData.defaultEditor) ??
                editorOptions.find((o) => o.value === QueryEditorMode.Builder)
              }
              onChange={onChangeHandler('defaultEditor', options, onOptionsChange)}
              width={40}
              disabled={options.readOnly}
            />
          </InlineField>
        </div>
        <div className="gf-form">
          <InlineField
            labelWidth={PROM_CONFIG_LABEL_WIDTH}
            label="Disable metrics lookup"
            tooltip={
              <>
                Checking this option will disable the metrics chooser and metric/label support in the query field&apos;s
                autocomplete. This helps if you have performance issues with bigger Prometheus instances. {docsTip()}
              </>
            }
            interactive={true}
            disabled={options.readOnly}
            className={styles.switchField}
          >
            <Switch
              value={options.jsonData.disableMetricsLookup ?? false}
              onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'disableMetricsLookup')}
            />
          </InlineField>
        </div>
      </div>

      <h6 className="page-heading">Performance</h6>
      {/* <h4 className="page-heading">Type and version</h4> */}
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
        <div className="gf-form-inline">
          <div className="gf-form">
            <InlineField
              label="Prometheus type"
              labelWidth={PROM_CONFIG_LABEL_WIDTH}
              tooltip={
                <>
                  Set this to the type of your prometheus database, e.g. Prometheus, Cortex, Mimir or Thanos. Changing
                  this field will save your current settings, and attempt to detect the version. Certain types of
                  Prometheus support or do not support various APIs. For example, some types support regex matching for
                  label queries to improve performance. Some types have an API for metadata. If you set this incorrectly
                  you may experience odd behavior when querying metrics and labels. Please check your Prometheus
                  documentation to ensure you enter the correct type. {docsTip()}
                </>
              }
              interactive={true}
            >
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
                width={40}
                disabled={options.readOnly}
              />
            </InlineField>
          </div>
        </div>
        <div className="gf-form-inline">
          {options.jsonData.prometheusType && (
            <div className="gf-form">
              <InlineField
                label={`${options.jsonData.prometheusType} version`}
                labelWidth={PROM_CONFIG_LABEL_WIDTH}
                tooltip={
                  <>
                    Use this to set the version of your {options.jsonData.prometheusType} instance if it is not
                    automatically configured. {docsTip()}
                  </>
                }
                interactive={true}
              >
                <Select
                  aria-label={`${options.jsonData.prometheusType} type`}
                  options={PromFlavorVersions[options.jsonData.prometheusType]}
                  value={PromFlavorVersions[options.jsonData.prometheusType]?.find(
                    (o) => o.value === options.jsonData.prometheusVersion
                  )}
                  onChange={onChangeHandler('prometheusVersion', options, onOptionsChange)}
                  width={40}
                  disabled={options.readOnly}
                />
              </InlineField>
            </div>
          )}
        </div>
        {config.featureToggles.prometheusResourceBrowserCache && (
          <div className="gf-form-inline">
            <div className="gf-form max-width-30">
              <InlineField
                label="Cache level"
                labelWidth={PROM_CONFIG_LABEL_WIDTH}
                tooltip={
                  <>
                    Sets the browser caching level for editor queries. Higher cache settings are recommended for high
                    cardinality data sources.
                  </>
                }
                interactive={true}
              >
                <Select
                  width={40}
                  onChange={onChangeHandler('cacheLevel', options, onOptionsChange)}
                  options={cacheValueOptions}
                  value={cacheValueOptions.find((o) => o.value === options.jsonData.cacheLevel)}
                />
              </InlineField>
            </div>
          </div>
        )}

        <div className="gf-form-inline">
          <div className="gf-form max-width-30">
            <InlineField
              label="Incremental querying (beta)"
              labelWidth={PROM_CONFIG_LABEL_WIDTH}
              tooltip={
                <>
                  This feature will change the default behavior of relative queries to always request fresh data from
                  the prometheus instance, instead query results will be cached, and only new records are requested.
                  Turn this on to decrease database and network load.
                </>
              }
              interactive={true}
              className={styles.switchField}
            >
              <Switch
                value={options.jsonData.incrementalQuerying ?? false}
                onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'incrementalQuerying')}
                disabled={options.readOnly}
              />
            </InlineField>
          </div>
        </div>

        <div className="gf-form-inline">
          {options.jsonData.incrementalQuerying && (
            <InlineField
              label="Query overlap window"
              labelWidth={PROM_CONFIG_LABEL_WIDTH}
              tooltip={
                <>
                  Set a duration like 10m or 120s or 0s. Default of 10 minutes. This duration will be added to the
                  duration of each incremental request.
                </>
              }
              interactive={true}
            >
              <>
                <Input
                  onBlur={(e) =>
                    updateValidDuration({ ...validDuration, incrementalQueryOverlapWindow: e.currentTarget.value })
                  }
                  className="width-25"
                  value={options.jsonData.incrementalQueryOverlapWindow ?? defaultPrometheusQueryOverlapWindow}
                  onChange={onChangeHandler('incrementalQueryOverlapWindow', options, onOptionsChange)}
                  spellCheck={false}
                  disabled={options.readOnly}
                />
                {validateInput(validDuration.incrementalQueryOverlapWindow, DURATION_REGEX, durationError)}
              </>
            </InlineField>
          )}
        </div>
      </div>

      <h6 className="page-heading">Other</h6>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form max-width-30">
            <InlineField
              label="Custom query parameters"
              labelWidth={PROM_CONFIG_LABEL_WIDTH}
              tooltip={
                <>
                  Add custom parameters to the Prometheus query URL. For example timeout, partial_response, dedup, or
                  max_source_resolution. Multiple parameters should be concatenated together with an ‘&’. {docsTip()}
                </>
              }
              interactive={true}
            >
              <Input
                className="width-20"
                value={options.jsonData.customQueryParameters}
                onChange={onChangeHandler('customQueryParameters', options, onOptionsChange)}
                spellCheck={false}
                placeholder="Example: max_source_resolution=5m&timeout=10"
                disabled={options.readOnly}
              />
            </InlineField>
          </div>
        </div>
        <div className="gf-form-inline">
          {/* HTTP Method */}
          <div className="gf-form">
            <InlineField
              labelWidth={PROM_CONFIG_LABEL_WIDTH}
              tooltip={
                <>
                  You can use either POST or GET HTTP method to query your Prometheus data source. POST is the
                  recommended method as it allows bigger queries. Change this to GET if you have a Prometheus version
                  older than 2.1 or if POST requests are restricted in your network. {docsTip()}
                </>
              }
              interactive={true}
              label="HTTP method"
            >
              <Select
                width={40}
                aria-label="Select HTTP method"
                options={httpOptions}
                value={httpOptions.find((o) => o.value === options.jsonData.httpMethod)}
                onChange={onChangeHandler('httpMethod', options, onOptionsChange)}
                disabled={options.readOnly}
              />
            </InlineField>
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
        disabled={options.readOnly}
      />
    </>
  );
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
