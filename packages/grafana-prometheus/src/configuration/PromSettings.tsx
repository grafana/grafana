// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/configuration/PromSettings.tsx
import { SyntheticEvent, useState } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  onUpdateDatasourceJsonDataOptionChecked,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ConfigSubSection } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { InlineField, Input, Select, Switch, useTheme2 } from '@grafana/ui';

import { SUGGESTIONS_LIMIT } from '../language_provider';
import { QueryEditorMode } from '../querybuilder/shared/types';
import { defaultPrometheusQueryOverlapWindow } from '../querycache/QueryCache';
import { PromApplication, PrometheusCacheLevel, PromOptions } from '../types';

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

// single duration input
export const DURATION_REGEX = /^$|^\d+(ms|[Mwdhmsy])$/;

// multiple duration input
export const MULTIPLE_DURATION_REGEX = /(\d+)(.+)/;

export const NON_NEGATIVE_INTEGER_REGEX = /^(0|[1-9]\d*)(\.\d+)?(e\+?\d+)?$/; // non-negative integers, including scientific notation

const durationError = 'Value is not valid, you can use number with time unit specifier: y, M, w, d, h, m, s';
export const countError = 'Value is not valid, you can use non-negative integers, including scientific notation';

export const PromSettings = (props: Props) => {
  const { options, onOptionsChange } = props;

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

  type ValidCount = {
    codeModeMetricNamesSuggestionLimit: string;
  };

  const [validCount, updateValidCount] = useState<ValidCount>({
    codeModeMetricNamesSuggestionLimit: '',
  });

  return (
    <>
      <ConfigSubSection title="Interval behaviour" className={styles.container}>
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
                    evaluation interval configured in your Prometheus config file. If you set this to a greater value
                    than your Prometheus config file interval, Grafana will evaluate the data according to this interval
                    and you will see less data points. Defaults to 15s. {docsTip()}
                  </>
                }
                interactive={true}
                disabled={options.readOnly}
              >
                <>
                  <Input
                    className="width-20"
                    value={options.jsonData.timeInterval}
                    spellCheck={false}
                    placeholder="15s"
                    onChange={onChangeHandler('timeInterval', options, onOptionsChange)}
                    onBlur={(e) =>
                      updateValidDuration({
                        ...validDuration,
                        timeInterval: e.currentTarget.value,
                      })
                    }
                    data-testid={selectors.components.DataSource.Prometheus.configPage.scrapeInterval}
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
                disabled={options.readOnly}
              >
                <>
                  <Input
                    className="width-20"
                    value={options.jsonData.queryTimeout}
                    onChange={onChangeHandler('queryTimeout', options, onOptionsChange)}
                    spellCheck={false}
                    placeholder="60s"
                    onBlur={(e) =>
                      updateValidDuration({
                        ...validDuration,
                        queryTimeout: e.currentTarget.value,
                      })
                    }
                    data-testid={selectors.components.DataSource.Prometheus.configPage.queryTimeout}
                  />
                  {validateInput(validDuration.queryTimeout, DURATION_REGEX, durationError)}
                </>
              </InlineField>
            </div>
          </div>
        </div>
      </ConfigSubSection>

      <ConfigSubSection title="Query editor" className={styles.container}>
        <div className="gf-form-group">
          <div className="gf-form">
            <InlineField
              label="Default editor"
              labelWidth={PROM_CONFIG_LABEL_WIDTH}
              tooltip={<>Set default editor option for all users of this data source. {docsTip()}</>}
              interactive={true}
              disabled={options.readOnly}
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
                data-testid={selectors.components.DataSource.Prometheus.configPage.defaultEditor}
              />
            </InlineField>
          </div>
          <div className="gf-form">
            <InlineField
              labelWidth={PROM_CONFIG_LABEL_WIDTH}
              label="Disable metrics lookup"
              tooltip={
                <>
                  Checking this option will disable the metrics chooser and metric/label support in the query
                  field&apos;s autocomplete. This helps if you have performance issues with bigger Prometheus instances.{' '}
                  {docsTip()}
                </>
              }
              interactive={true}
              disabled={options.readOnly}
              className={styles.switchField}
            >
              <Switch
                value={options.jsonData.disableMetricsLookup ?? false}
                onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'disableMetricsLookup')}
                id={selectors.components.DataSource.Prometheus.configPage.disableMetricLookup}
              />
            </InlineField>
          </div>
        </div>
      </ConfigSubSection>

      <ConfigSubSection title="Performance" className={styles.container}>
        {!options.jsonData.prometheusType && !options.jsonData.prometheusVersion && options.readOnly && (
          <div className={styles.versionMargin}>
            For more information on configuring prometheus type and version in data sources, see the{' '}
            <a
              className={styles.textUnderline}
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
                    {/* , and attempt to detect the version */}
                    Set this to the type of your prometheus database, e.g. Prometheus, Cortex, Mimir or Thanos. Changing
                    this field will save your current settings. Certain types of Prometheus supports or does not support
                    various APIs. For example, some types support regex matching for label queries to improve
                    performance. Some types have an API for metadata. If you set this incorrectly you may experience odd
                    behavior when querying metrics and labels. Please check your Prometheus documentation to ensure you
                    enter the correct type. {docsTip()}
                  </>
                }
                interactive={true}
                disabled={options.readOnly}
              >
                <Select
                  aria-label="Prometheus type"
                  options={prometheusFlavorSelectItems}
                  value={prometheusFlavorSelectItems.find((o) => o.value === options.jsonData.prometheusType)}
                  onChange={onChangeHandler('prometheusType', options, onOptionsChange)}
                  width={40}
                  data-testid={selectors.components.DataSource.Prometheus.configPage.prometheusType}
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
                  disabled={options.readOnly}
                >
                  <Select
                    aria-label={`${options.jsonData.prometheusType} type`}
                    options={PromFlavorVersions[options.jsonData.prometheusType]}
                    value={PromFlavorVersions[options.jsonData.prometheusType]?.find(
                      (o) => o.value === options.jsonData.prometheusVersion
                    )}
                    onChange={onChangeHandler('prometheusVersion', options, onOptionsChange)}
                    width={40}
                    data-testid={selectors.components.DataSource.Prometheus.configPage.prometheusVersion}
                  />
                </InlineField>
              </div>
            )}
          </div>

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
                disabled={options.readOnly}
              >
                <Select
                  width={40}
                  onChange={onChangeHandler('cacheLevel', options, onOptionsChange)}
                  options={cacheValueOptions}
                  value={
                    cacheValueOptions.find((o) => o.value === options.jsonData.cacheLevel) ?? PrometheusCacheLevel.Low
                  }
                  data-testid={selectors.components.DataSource.Prometheus.configPage.cacheLevel}
                />
              </InlineField>
            </div>
          </div>

          {config.featureToggles.prometheusCodeModeMetricNamesSearch && (
            <div className="gf-form-inline">
              <div className="gf-form">
                <InlineField
                  label="Metric names suggestion limit"
                  labelWidth={PROM_CONFIG_LABEL_WIDTH}
                  tooltip={
                    <>
                      The maximum number of metric names that may appear as autocomplete suggestions in the query
                      editor&apos;s Code mode.
                    </>
                  }
                  interactive={true}
                  disabled={options.readOnly}
                >
                  <>
                    <Input
                      className="width-20"
                      value={options.jsonData.codeModeMetricNamesSuggestionLimit}
                      onChange={onChangeHandler('codeModeMetricNamesSuggestionLimit', options, onOptionsChange)}
                      spellCheck={false}
                      placeholder={SUGGESTIONS_LIMIT.toString()}
                      onBlur={(e) =>
                        updateValidCount({
                          ...validCount,
                          codeModeMetricNamesSuggestionLimit: e.currentTarget.value,
                        })
                      }
                      data-testid={
                        selectors.components.DataSource.Prometheus.configPage.codeModeMetricNamesSuggestionLimit
                      }
                    />
                    {validateInput(
                      validCount.codeModeMetricNamesSuggestionLimit,
                      NON_NEGATIVE_INTEGER_REGEX,
                      countError
                    )}
                  </>
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
                disabled={options.readOnly}
              >
                <Switch
                  value={options.jsonData.incrementalQuerying ?? false}
                  onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'incrementalQuerying')}
                  id={selectors.components.DataSource.Prometheus.configPage.incrementalQuerying}
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
                disabled={options.readOnly}
              >
                <>
                  <Input
                    onBlur={(e) =>
                      updateValidDuration({
                        ...validDuration,
                        incrementalQueryOverlapWindow: e.currentTarget.value,
                      })
                    }
                    className="width-20"
                    value={options.jsonData.incrementalQueryOverlapWindow ?? defaultPrometheusQueryOverlapWindow}
                    onChange={onChangeHandler('incrementalQueryOverlapWindow', options, onOptionsChange)}
                    spellCheck={false}
                    data-testid={selectors.components.DataSource.Prometheus.configPage.queryOverlapWindow}
                  />
                  {validateInput(validDuration.incrementalQueryOverlapWindow, MULTIPLE_DURATION_REGEX, durationError)}
                </>
              </InlineField>
            )}
          </div>

          <div className="gf-form-inline">
            <div className="gf-form max-width-30">
              <InlineField
                label="Disable recording rules (beta)"
                labelWidth={PROM_CONFIG_LABEL_WIDTH}
                tooltip={<>This feature will disable recording rules Turn this on to improve dashboard performance</>}
                interactive={true}
                className={styles.switchField}
                disabled={options.readOnly}
              >
                <Switch
                  value={options.jsonData.disableRecordingRules ?? false}
                  onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'disableRecordingRules')}
                  id={selectors.components.DataSource.Prometheus.configPage.disableRecordingRules}
                />
              </InlineField>
            </div>
          </div>
        </div>
      </ConfigSubSection>

      <ConfigSubSection title="Other" className={styles.container}>
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
                disabled={options.readOnly}
              >
                <Input
                  className="width-20"
                  value={options.jsonData.customQueryParameters}
                  onChange={onChangeHandler('customQueryParameters', options, onOptionsChange)}
                  spellCheck={false}
                  placeholder="Example: max_source_resolution=5m&timeout=10"
                  data-testid={selectors.components.DataSource.Prometheus.configPage.customQueryParameters}
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
                disabled={options.readOnly}
              >
                <Select
                  width={40}
                  aria-label="Select HTTP method"
                  options={httpOptions}
                  value={httpOptions.find((o) => o.value === options.jsonData.httpMethod)}
                  onChange={onChangeHandler('httpMethod', options, onOptionsChange)}
                  data-testid={selectors.components.DataSource.Prometheus.configPage.httpMethod}
                />
              </InlineField>
            </div>
          </div>
          <InlineField
            labelWidth={PROM_CONFIG_LABEL_WIDTH}
            label="Use series endpoint"
            tooltip={
              <>
                Checking this option will favor the series endpoint with match[] parameter over the label values
                endpoint with match[] parameter. While the label values endpoint is considered more performant, some
                users may prefer the series because it has a POST method while the label values endpoint only has a GET
                method. {docsTip()}
              </>
            }
            interactive={true}
            disabled={options.readOnly}
            className={styles.switchField}
          >
            <Switch
              value={options.jsonData.seriesEndpoint ?? false}
              onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'seriesEndpoint')}
            />
          </InlineField>
        </div>
      </ConfigSubSection>

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

  if ('currentTarget' in eventItem) {
    return eventItem.currentTarget.value;
  }

  return eventItem.value;
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
