// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/configuration/PromSettings.tsx
import { SyntheticEvent, useState } from 'react';

import {
  DataSourcePluginOptionsEditorProps,
  DataSourceSettings,
  onUpdateDatasourceJsonDataOptionChecked,
  SelectableValue,
  updateDatasourcePluginJsonDataOption,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { ConfigSubSection } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { InlineField, Input, Select, Switch, TextLink, useTheme2 } from '@grafana/ui';

import {
  countError,
  DEFAULT_SERIES_LIMIT,
  DURATION_REGEX,
  durationError,
  MULTIPLE_DURATION_REGEX,
  NON_NEGATIVE_INTEGER_REGEX,
  PROM_CONFIG_LABEL_WIDTH,
  seriesLimitError,
  SUGGESTIONS_LIMIT,
} from '../constants';
import { QueryEditorMode } from '../querybuilder/shared/types';
import { defaultPrometheusQueryOverlapWindow } from '../querycache/QueryCache';
import { PromApplication, PrometheusCacheLevel, PromOptions } from '../types';

import { ExemplarsSettings } from './ExemplarsSettings';
import { PromFlavorVersions } from './PromFlavorVersions';
import { docsTip, overhaulStyles, validateInput } from './shared/utils';

type Props = Pick<DataSourcePluginOptionsEditorProps<PromOptions>, 'options' | 'onOptionsChange'>;

const httpOptions = [
  { value: 'POST', label: 'POST' },
  { value: 'GET', label: 'GET' },
];

const cacheValueOptions = [
  { value: PrometheusCacheLevel.Low, label: 'Low' },
  { value: PrometheusCacheLevel.Medium, label: 'Medium' },
  { value: PrometheusCacheLevel.High, label: 'High' },
  { value: PrometheusCacheLevel.None, label: 'None' },
];

type PrometheusSelectItemsType = Array<{ value: PromApplication; label: PromApplication }>;

type ValidDuration = {
  timeInterval: string;
  queryTimeout: string;
  incrementalQueryOverlapWindow: string;
};

type ValidCount = {
  codeModeMetricNamesSuggestionLimit: string;
};

const prometheusFlavorSelectItems: PrometheusSelectItemsType = [
  { value: PromApplication.Prometheus, label: PromApplication.Prometheus },
  { value: PromApplication.Cortex, label: PromApplication.Cortex },
  { value: PromApplication.Mimir, label: PromApplication.Mimir },
  { value: PromApplication.Thanos, label: PromApplication.Thanos },
];

const getOptionsWithDefaults = (options: DataSourceSettings<PromOptions>) => {
  if (options.jsonData.httpMethod) {
    return options;
  }

  // We are explicitly adding httpMethod so, it is correctly displayed in dropdown.
  // This way, it is more predictable for users.
  return { ...options, jsonData: { ...options.jsonData, httpMethod: 'POST' } };
};

export const PromSettings = (props: Props) => {
  const theme = useTheme2();
  const styles = overhaulStyles(theme);
  const { onOptionsChange } = props;

  const editorOptions = [
    {
      value: QueryEditorMode.Builder,
      label: t('grafana-prometheus.configuration.prom-settings.editor-options.label-builder', 'Builder'),
    },
    {
      value: QueryEditorMode.Code,
      label: t('grafana-prometheus.configuration.prom-settings.editor-options.label-code', 'Code'),
    },
  ];

  const optionsWithDefaults = getOptionsWithDefaults(props.options);
  const [validDuration, updateValidDuration] = useState<ValidDuration>({
    timeInterval: '',
    queryTimeout: '',
    incrementalQueryOverlapWindow: '',
  });

  const [validCount, updateValidCount] = useState<ValidCount>({
    codeModeMetricNamesSuggestionLimit: '',
  });

  const [seriesLimit, setSeriesLimit] = useState<string>(
    optionsWithDefaults.jsonData.seriesLimit?.toString() || `${DEFAULT_SERIES_LIMIT}`
  );

  return (
    <>
      <ConfigSubSection
        title={t('grafana-prometheus.configuration.prom-settings.title-interval-behaviour', 'Interval behaviour')}
        className={styles.container}
      >
        <div className="gf-form-group">
          {/* Scrape interval */}
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineField
                label={t('grafana-prometheus.configuration.prom-settings.label-scrape-interval', 'Scrape interval')}
                labelWidth={PROM_CONFIG_LABEL_WIDTH}
                tooltip={
                  <>
                    <Trans
                      i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-scrape-interval"
                      values={{ default: '15s' }}
                    >
                      This interval is how frequently Prometheus scrapes targets. Set this to the typical scrape and
                      evaluation interval configured in your Prometheus config file. If you set this to a greater value
                      than your Prometheus config file interval, Grafana will evaluate the data according to this
                      interval and you will see less data points. Defaults to {'{{default}}'}.
                    </Trans>{' '}
                    {docsTip()}
                  </>
                }
                interactive={true}
                disabled={optionsWithDefaults.readOnly}
              >
                <>
                  <Input
                    className="width-20"
                    value={optionsWithDefaults.jsonData.timeInterval}
                    spellCheck={false}
                    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                    placeholder="15s"
                    onChange={onChangeHandler('timeInterval', optionsWithDefaults, onOptionsChange)}
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
                label={t('grafana-prometheus.configuration.prom-settings.label-query-timeout', 'Query timeout')}
                labelWidth={PROM_CONFIG_LABEL_WIDTH}
                tooltip={
                  <>
                    <Trans i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-query-timeout">
                      Set the Prometheus query timeout.
                    </Trans>{' '}
                    {docsTip()}
                  </>
                }
                interactive={true}
                disabled={optionsWithDefaults.readOnly}
              >
                <>
                  <Input
                    className="width-20"
                    value={optionsWithDefaults.jsonData.queryTimeout}
                    onChange={onChangeHandler('queryTimeout', optionsWithDefaults, onOptionsChange)}
                    spellCheck={false}
                    // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
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

      <ConfigSubSection
        title={t('grafana-prometheus.configuration.prom-settings.title-query-editor', 'Query editor')}
        className={styles.container}
      >
        <div className="gf-form-group">
          <div className="gf-form">
            <InlineField
              label={t('grafana-prometheus.configuration.prom-settings.label-default-editor', 'Default editor')}
              labelWidth={PROM_CONFIG_LABEL_WIDTH}
              tooltip={
                <>
                  <Trans i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-default-editor">
                    Set default editor option for all users of this data source.
                  </Trans>{' '}
                  {docsTip()}
                </>
              }
              interactive={true}
              disabled={optionsWithDefaults.readOnly}
            >
              <Select
                aria-label={t(
                  'grafana-prometheus.configuration.prom-settings.aria-label-default-editor',
                  'Default Editor (Code or Builder)'
                )}
                options={editorOptions}
                value={
                  editorOptions.find((o) => o.value === optionsWithDefaults.jsonData.defaultEditor) ??
                  editorOptions.find((o) => o.value === QueryEditorMode.Builder)
                }
                onChange={onChangeHandler('defaultEditor', optionsWithDefaults, onOptionsChange)}
                width={40}
                data-testid={selectors.components.DataSource.Prometheus.configPage.defaultEditor}
              />
            </InlineField>
          </div>
          <div className="gf-form">
            <InlineField
              labelWidth={PROM_CONFIG_LABEL_WIDTH}
              label={t(
                'grafana-prometheus.configuration.prom-settings.label-disable-metrics-lookup',
                'Disable metrics lookup'
              )}
              tooltip={
                <>
                  <Trans i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-disable-metrics-lookup">
                    Checking this option will disable the metrics chooser and metric/label support in the query
                    field&apos;s autocomplete. This helps if you have performance issues with bigger Prometheus
                    instances.{' '}
                  </Trans>
                  {docsTip()}
                </>
              }
              interactive={true}
              disabled={optionsWithDefaults.readOnly}
              className={styles.switchField}
            >
              <Switch
                value={optionsWithDefaults.jsonData.disableMetricsLookup ?? false}
                onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'disableMetricsLookup')}
                id={selectors.components.DataSource.Prometheus.configPage.disableMetricLookup}
              />
            </InlineField>
          </div>
        </div>
      </ConfigSubSection>

      <ConfigSubSection
        title={t('grafana-prometheus.configuration.prom-settings.title-performance', 'Performance')}
        className={styles.container}
      >
        {!optionsWithDefaults.jsonData.prometheusType &&
          !optionsWithDefaults.jsonData.prometheusVersion &&
          optionsWithDefaults.readOnly && (
            <div className={styles.versionMargin}>
              <Trans i18nKey="grafana-prometheus.configuration.prom-settings.more-info">
                For more information on configuring prometheus type and version in data sources, see the{' '}
                <TextLink external href="https://grafana.com/docs/grafana/latest/administration/provisioning/">
                  provisioning documentation
                </TextLink>
                .
              </Trans>
            </div>
          )}
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form">
              <InlineField
                label={t('grafana-prometheus.configuration.prom-settings.label-prometheus-type', 'Prometheus type')}
                labelWidth={PROM_CONFIG_LABEL_WIDTH}
                tooltip={
                  <>
                    {/* , and attempt to detect the version */}
                    <Trans i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-prometheus-type">
                      Set this to the type of your prometheus database, e.g. Prometheus, Cortex, Mimir or Thanos.
                      Changing this field will save your current settings. Certain types of Prometheus supports or does
                      not support various APIs. For example, some types support regex matching for label queries to
                      improve performance. Some types have an API for metadata. If you set this incorrectly you may
                      experience odd behavior when querying metrics and labels. Please check your Prometheus
                      documentation to ensure you enter the correct type.
                    </Trans>{' '}
                    {docsTip()}
                  </>
                }
                interactive={true}
                disabled={optionsWithDefaults.readOnly}
              >
                <Select
                  aria-label={t(
                    'grafana-prometheus.configuration.prom-settings.aria-label-prometheus-type',
                    'Prometheus type'
                  )}
                  options={prometheusFlavorSelectItems}
                  value={prometheusFlavorSelectItems.find(
                    (o) => o.value === optionsWithDefaults.jsonData.prometheusType
                  )}
                  onChange={onChangeHandler('prometheusType', optionsWithDefaults, onOptionsChange)}
                  width={40}
                  data-testid={selectors.components.DataSource.Prometheus.configPage.prometheusType}
                />
              </InlineField>
            </div>
          </div>
          <div className="gf-form-inline">
            {optionsWithDefaults.jsonData.prometheusType && (
              <div className="gf-form">
                <InlineField
                  label={t(
                    'grafana-prometheus.configuration.prom-settings.label-prom-type-version',
                    '{{promType}} version',
                    {
                      promType: optionsWithDefaults.jsonData.prometheusType,
                    }
                  )}
                  labelWidth={PROM_CONFIG_LABEL_WIDTH}
                  tooltip={
                    <>
                      <Trans
                        i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-prom-type-version"
                        values={{ promType: optionsWithDefaults.jsonData.prometheusType }}
                      >
                        Use this to set the version of your {'{{promType}}'} instance if it is not automatically
                        configured.
                      </Trans>{' '}
                      {docsTip()}
                    </>
                  }
                  interactive={true}
                  disabled={optionsWithDefaults.readOnly}
                >
                  <Select
                    aria-label={t(
                      'grafana-prometheus.configuration.prom-settings.aria-label-prom-type-type',
                      '{{promType}} type',
                      {
                        promType: optionsWithDefaults.jsonData.prometheusType,
                      }
                    )}
                    options={PromFlavorVersions[optionsWithDefaults.jsonData.prometheusType]}
                    value={PromFlavorVersions[optionsWithDefaults.jsonData.prometheusType]?.find(
                      (o) => o.value === optionsWithDefaults.jsonData.prometheusVersion
                    )}
                    onChange={onChangeHandler('prometheusVersion', optionsWithDefaults, onOptionsChange)}
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
                label={t('grafana-prometheus.configuration.prom-settings.label-cache-level', 'Cache level')}
                labelWidth={PROM_CONFIG_LABEL_WIDTH}
                tooltip={
                  <>
                    <Trans i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-cache-level">
                      Sets the browser caching level for editor queries. Higher cache settings are recommended for high
                      cardinality data sources.
                    </Trans>
                  </>
                }
                interactive={true}
                disabled={optionsWithDefaults.readOnly}
              >
                <Select
                  width={40}
                  onChange={onChangeHandler('cacheLevel', optionsWithDefaults, onOptionsChange)}
                  options={cacheValueOptions}
                  value={
                    cacheValueOptions.find((o) => o.value === optionsWithDefaults.jsonData.cacheLevel) ??
                    PrometheusCacheLevel.Low
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
                  label={t(
                    'grafana-prometheus.configuration.prom-settings.label-metric-names-suggestion-limit',
                    'Metric names suggestion limit'
                  )}
                  labelWidth={PROM_CONFIG_LABEL_WIDTH}
                  tooltip={
                    <>
                      <Trans i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-metric-names-suggestion-limit">
                        The maximum number of metric names that may appear as autocomplete suggestions in the query
                        editor&apos;s Code mode.
                      </Trans>
                    </>
                  }
                  interactive={true}
                  disabled={optionsWithDefaults.readOnly}
                >
                  <>
                    <Input
                      className="width-20"
                      value={optionsWithDefaults.jsonData.codeModeMetricNamesSuggestionLimit}
                      onChange={onChangeHandler(
                        'codeModeMetricNamesSuggestionLimit',
                        optionsWithDefaults,
                        onOptionsChange
                      )}
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
                label={t(
                  'grafana-prometheus.configuration.prom-settings.label-incremental-querying-beta',
                  'Incremental querying (beta)'
                )}
                labelWidth={PROM_CONFIG_LABEL_WIDTH}
                tooltip={
                  <>
                    <Trans i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-incremental-querying-beta">
                      This feature will change the default behavior of relative queries to always request fresh data
                      from the prometheus instance, instead query results will be cached, and only new records are
                      requested. Turn this on to decrease database and network load.
                    </Trans>
                  </>
                }
                interactive={true}
                className={styles.switchField}
                disabled={optionsWithDefaults.readOnly}
              >
                <Switch
                  value={optionsWithDefaults.jsonData.incrementalQuerying ?? false}
                  onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'incrementalQuerying')}
                  id={selectors.components.DataSource.Prometheus.configPage.incrementalQuerying}
                />
              </InlineField>
            </div>
          </div>

          <div className="gf-form-inline">
            {optionsWithDefaults.jsonData.incrementalQuerying && (
              <InlineField
                label={t(
                  'grafana-prometheus.configuration.prom-settings.label-query-overlap-window',
                  'Query overlap window'
                )}
                labelWidth={PROM_CONFIG_LABEL_WIDTH}
                tooltip={
                  <>
                    <Trans
                      i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-query-overlap-window"
                      values={{
                        example1: '10m',
                        example2: '120s',
                        example3: '0s',
                        default: '10m',
                      }}
                    >
                      Set a duration like {'{{example1}}'} or {'{{example2}}'} or {'{{example3}}'}. Default of{' '}
                      {'{{default}}'}. This duration will be added to the duration of each incremental request.
                    </Trans>
                  </>
                }
                interactive={true}
                disabled={optionsWithDefaults.readOnly}
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
                    value={
                      optionsWithDefaults.jsonData.incrementalQueryOverlapWindow ?? defaultPrometheusQueryOverlapWindow
                    }
                    onChange={onChangeHandler('incrementalQueryOverlapWindow', optionsWithDefaults, onOptionsChange)}
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
                label={t(
                  'grafana-prometheus.configuration.prom-settings.label-disable-recording-rules-beta',
                  'Disable recording rules (beta)'
                )}
                labelWidth={PROM_CONFIG_LABEL_WIDTH}
                tooltip={
                  <>
                    <Trans i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-disable-recording-rules-beta">
                      This feature will disable recording rules. Turn this on to improve dashboard performance
                    </Trans>
                  </>
                }
                interactive={true}
                className={styles.switchField}
                disabled={optionsWithDefaults.readOnly}
              >
                <Switch
                  value={optionsWithDefaults.jsonData.disableRecordingRules ?? false}
                  onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'disableRecordingRules')}
                  id={selectors.components.DataSource.Prometheus.configPage.disableRecordingRules}
                />
              </InlineField>
            </div>
          </div>
        </div>
      </ConfigSubSection>

      <ConfigSubSection
        title={t('grafana-prometheus.configuration.prom-settings.title-other', 'Other')}
        className={styles.container}
      >
        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form max-width-30">
              <InlineField
                label={t(
                  'grafana-prometheus.configuration.prom-settings.label-custom-query-parameters',
                  'Custom query parameters'
                )}
                labelWidth={PROM_CONFIG_LABEL_WIDTH}
                tooltip={
                  <>
                    <Trans
                      i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-custom-query-parameters"
                      values={{
                        example1: 'timeout',
                        example2: 'partial_response',
                        example3: 'dedup',
                        example4: 'max_source_resolution',
                        concatenationChar: '‘&’',
                      }}
                    >
                      Add custom parameters to the Prometheus query URL. For example {'{{example1}}'}, {'{{example2}}'},{' '}
                      {'{{example3}}'}, or
                      {'{{example4}}'}. Multiple parameters should be concatenated together with{' '}
                      {'{{concatenationChar}}'}.
                    </Trans>{' '}
                    {docsTip()}
                  </>
                }
                interactive={true}
                disabled={optionsWithDefaults.readOnly}
              >
                <Input
                  className="width-20"
                  value={optionsWithDefaults.jsonData.customQueryParameters}
                  onChange={onChangeHandler('customQueryParameters', optionsWithDefaults, onOptionsChange)}
                  spellCheck={false}
                  placeholder={t(
                    'grafana-prometheus.configuration.prom-settings.placeholder-example-maxsourceresolutionmtimeout',
                    'Example: {{example}}',
                    { example: 'max_source_resolution=5m&timeout=10' }
                  )}
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
                    <Trans i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-http-method">
                      You can use either POST or GET HTTP method to query your Prometheus data source. POST is the
                      recommended method as it allows bigger queries. Change this to GET if you have a Prometheus
                      version older than 2.1 or if POST requests are restricted in your network.
                    </Trans>{' '}
                    {docsTip()}
                  </>
                }
                interactive={true}
                label={t('grafana-prometheus.configuration.prom-settings.label-http-method', 'HTTP method')}
                disabled={optionsWithDefaults.readOnly}
              >
                <Select
                  width={40}
                  aria-label={t(
                    'grafana-prometheus.configuration.prom-settings.aria-label-select-http-method',
                    'Select HTTP method'
                  )}
                  options={httpOptions}
                  value={httpOptions.find((o) => o.value === optionsWithDefaults.jsonData.httpMethod)}
                  onChange={onChangeHandler('httpMethod', optionsWithDefaults, onOptionsChange)}
                  data-testid={selectors.components.DataSource.Prometheus.configPage.httpMethod}
                />
              </InlineField>
            </div>
          </div>
          <InlineField
            labelWidth={PROM_CONFIG_LABEL_WIDTH}
            label={t('grafana-prometheus.configuration.prom-settings.label-series-limit', 'Series limit')}
            tooltip={
              <>
                <Trans i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-series-limit">
                  The limit applies to all resources (metrics, labels, and values) for both endpoints (series and
                  labels). Leave the field empty to use the default limit (40000). Set to 0 to disable the limit and
                  fetch everything — this may cause performance issues. Default limit is 40000.
                </Trans>
                {docsTip()}
              </>
            }
            interactive={true}
            disabled={optionsWithDefaults.readOnly}
          >
            <>
              <Input
                className="width-20"
                value={seriesLimit}
                spellCheck={false}
                // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                placeholder="40000"
                onChange={(event: { currentTarget: { value: string } }) => {
                  setSeriesLimit(event.currentTarget.value);
                  onOptionsChange({
                    ...optionsWithDefaults,
                    jsonData: {
                      ...optionsWithDefaults.jsonData,
                      seriesLimit: parseInt(event.currentTarget.value, 10),
                    },
                  });
                }}
                onBlur={(e) => validateInput(e.currentTarget.value, NON_NEGATIVE_INTEGER_REGEX, seriesLimitError)}
                data-testid={selectors.components.DataSource.Prometheus.configPage.seriesLimit}
              />
              {validateInput(seriesLimit, NON_NEGATIVE_INTEGER_REGEX, seriesLimitError)}
            </>
          </InlineField>
          <InlineField
            labelWidth={PROM_CONFIG_LABEL_WIDTH}
            label={t('grafana-prometheus.configuration.prom-settings.label-use-series-endpoint', 'Use series endpoint')}
            tooltip={
              <>
                <Trans
                  i18nKey="grafana-prometheus.configuration.prom-settings.tooltip-use-series-endpoint"
                  values={{ exampleParameter: 'match[]' }}
                >
                  Checking this option will favor the series endpoint with {'{{exampleParameter}}'} parameter over the
                  label values endpoint with {'{{exampleParameter}}'} parameter. While the label values endpoint is
                  considered more performant, some users may prefer the series because it has a POST method while the
                  label values endpoint only has a GET method.
                </Trans>{' '}
                {docsTip()}
              </>
            }
            interactive={true}
            disabled={optionsWithDefaults.readOnly}
            className={styles.switchField}
          >
            <Switch
              value={optionsWithDefaults.jsonData.seriesEndpoint ?? false}
              onChange={onUpdateDatasourceJsonDataOptionChecked(props, 'seriesEndpoint')}
            />
          </InlineField>
        </div>
      </ConfigSubSection>

      <ExemplarsSettings
        options={optionsWithDefaults.jsonData.exemplarTraceIdDestinations}
        onChange={(exemplarOptions) =>
          updateDatasourcePluginJsonDataOption(
            { onOptionsChange, options: optionsWithDefaults },
            'exemplarTraceIdDestinations',
            exemplarOptions
          )
        }
        disabled={optionsWithDefaults.readOnly}
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
