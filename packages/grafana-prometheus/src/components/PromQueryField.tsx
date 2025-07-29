// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PromQueryField.tsx
import { css, cx } from '@emotion/css';
import { ReactNode, useCallback, useEffect, useState } from 'react';

import {
  DataFrame,
  getDefaultTimeRange,
  isDataFrame,
  QueryEditorProps,
  QueryHint,
  toLegacyResponseData,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { clearButtonStyles, Icon, useTheme2 } from '@grafana/ui';

import { PrometheusDatasource } from '../datasource';
import { getInitHints } from '../query_hints';
import { PromOptions, PromQuery } from '../types';

import { MetricsBrowser } from './metrics-browser/MetricsBrowser';
import { MetricsBrowserProvider } from './metrics-browser/MetricsBrowserContext';
import { MonacoQueryFieldWrapper } from './monaco-query-field/MonacoQueryFieldWrapper';

interface PromQueryFieldProps extends QueryEditorProps<PrometheusDatasource, PromQuery, PromOptions> {
  ExtraFieldElement?: ReactNode;
  hideMetricsBrowser?: boolean;
  'data-testid'?: string;
}

export const PromQueryField = (props: PromQueryFieldProps) => {
  const {
    app,
    datasource,
    datasource: { languageProvider },
    query,
    ExtraFieldElement,
    history = [],
    data,
    range,
    onChange,
    onRunQuery,
    hideMetricsBrowser = false,
  } = props;

  const theme = useTheme2();

  const [hint, setHint] = useState<QueryHint | null>(null);
  const [labelBrowserVisible, setLabelBrowserVisible] = useState(false);

  const refreshHint = useCallback(
    (series: DataFrame[]) => {
      const initHints = getInitHints(datasource);
      const initHint = initHints[0] ?? null;

      // If no data or empty series, use default hint
      if (!data?.series?.length) {
        setHint(initHint);
        return;
      }

      const result = isDataFrame(series[0]) ? series.map(toLegacyResponseData) : series;
      const queryHints = datasource.getQueryHints(query, result);
      let queryHint = queryHints.length > 0 ? queryHints[0] : null;

      setHint(queryHint ?? initHint);
    },
    [data, datasource, query]
  );

  useEffect(() => {
    refreshHint(data?.series ?? []);
  }, [data?.series, refreshHint]);

  const onChangeQuery = (value: string, override?: boolean) => {
    if (!onChange) {
      return;
    }
    // Send text change to parent
    const nextQuery: PromQuery = { ...query, expr: value };
    onChange(nextQuery);

    if (override && onRunQuery) {
      onRunQuery();
    }
  };

  const onChangeLabelBrowser = (selector: string) => {
    onChangeQuery(selector, true);
    setLabelBrowserVisible(false);
  };

  const onClickChooserButton = () => {
    setLabelBrowserVisible(!labelBrowserVisible);

    reportInteraction('user_grafana_prometheus_metrics_browser_clicked', {
      editorMode: labelBrowserVisible ? 'metricViewClosed' : 'metricViewOpen',
      app: app ?? '',
    });
  };

  const onClickHintFix = () => {
    if (hint?.fix?.action) {
      onChange(datasource.modifyQuery(query, hint.fix.action));
    }
    onRunQuery();
  };

  return (
    <>
      <div
        className="gf-form-inline gf-form-inline--xs-view-flex-column flex-grow-1"
        data-testid={props['data-testid']}
      >
        {!hideMetricsBrowser && (
          <button
            className="gf-form-label query-keyword pointer"
            onClick={onClickChooserButton}
            disabled={datasource.lookupsDisabled}
            type="button"
            data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.openButton}
          >
            {datasource.lookupsDisabled ? (
              <Trans i18nKey="grafana-prometheus.metrics-browser.disabled-label">(Disabled)</Trans>
            ) : (
              <Trans i18nKey="grafana-prometheus.metrics-browser.enabled-label">Metrics browser</Trans>
            )}
            <Icon name={labelBrowserVisible ? 'angle-down' : 'angle-right'} />
          </button>
        )}

        <div className="flex-grow-1 min-width-15">
          <MonacoQueryFieldWrapper
            languageProvider={languageProvider}
            history={history}
            onChange={onChangeQuery}
            onRunQuery={onRunQuery}
            initialValue={query.expr ?? ''}
            placeholder={t(
              'grafana-prometheus.components.prom-query-field.placeholder-enter-a-prom-ql-query',
              'Enter a PromQL query…'
            )}
            datasource={datasource}
            timeRange={range ?? getDefaultTimeRange()}
          />
        </div>
      </div>
      {labelBrowserVisible && (
        <div className="gf-form">
          <MetricsBrowserProvider
            timeRange={range ?? getDefaultTimeRange()}
            languageProvider={languageProvider}
            onChange={onChangeLabelBrowser}
          >
            <MetricsBrowser />
          </MetricsBrowserProvider>
        </div>
      )}
      {ExtraFieldElement}
      {hint ? (
        <div
          className={css({
            flexBasis: '100%',
          })}
        >
          <div className="text-warning">
            {hint.label}{' '}
            {hint.fix ? (
              <button
                type="button"
                className={cx(clearButtonStyles(theme), 'text-link', 'muted')}
                onClick={onClickHintFix}
              >
                {hint.fix.label}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
};
