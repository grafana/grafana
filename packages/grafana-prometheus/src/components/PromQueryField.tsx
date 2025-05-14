// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PromQueryField.tsx
import { css, cx } from '@emotion/css';
import { MutableRefObject, ReactNode, useCallback, useState } from 'react';

import { getDefaultTimeRange, isDataFrame, QueryEditorProps, QueryHint, toLegacyResponseData } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { clearButtonStyles, Icon, useTheme2 } from '@grafana/ui';

import { PrometheusDatasource } from '../datasource';
import { getInitHints } from '../query_hints';
import { PromOptions, PromQuery } from '../types';

import { CancelablePromise, isCancelablePromiseRejection, makePromiseCancelable } from './cancelable-promise';
import { MetricsBrowser } from './metrics-browser/MetricsBrowser';
import { MetricsBrowserProvider } from './metrics-browser/MetricsBrowserContext';
import { MonacoQueryFieldWrapper } from './monaco-query-field/MonacoQueryFieldWrapper';
import { useMetricsState } from './useMetricsState';
import { usePromQueryFieldEffects } from './usePromQueryFieldEffects';

interface PromQueryFieldProps extends QueryEditorProps<PrometheusDatasource, PromQuery, PromOptions> {
  ExtraFieldElement?: ReactNode;
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
  } = props;

  const theme = useTheme2();

  const [syntaxLoaded, setSyntaxLoaded] = useState(false);
  const [hint, setHint] = useState<QueryHint | null>(null);
  const [labelBrowserVisible, setLabelBrowserVisible] = useState(false);

  const updateLanguage = useCallback(() => {
    if (languageProvider.metrics) {
      setSyntaxLoaded(true);
    }
  }, [languageProvider]);

  const refreshMetrics = useCallback(
    async (languageProviderInitRef: MutableRefObject<CancelablePromise<any> | null>) => {
      // Cancel any existing initialization using the ref
      if (languageProviderInitRef.current) {
        languageProviderInitRef.current.cancel();
      }

      if (!languageProvider || !range) {
        return;
      }

      try {
        const initialization = makePromiseCancelable(languageProvider.start(range));
        languageProviderInitRef.current = initialization;

        const remainingTasks = await initialization.promise;

        // If there are remaining tasks, wait for them
        if (Array.isArray(remainingTasks) && remainingTasks.length > 0) {
          await Promise.all(remainingTasks);
        }

        updateLanguage();
      } catch (err) {
        if (isCancelablePromiseRejection(err) && err.isCanceled) {
          // do nothing, promise was canceled
        } else {
          throw err;
        }
      } finally {
        languageProviderInitRef.current = null;
      }
    },
    [languageProvider, range, updateLanguage]
  );

  const refreshHint = useCallback(() => {
    const initHints = getInitHints(datasource);
    const initHint = initHints[0] ?? null;

    // If no data or empty series, use default hint
    if (!data?.series?.length) {
      setHint(initHint);
      return;
    }

    const result = isDataFrame(data.series[0]) ? data.series.map(toLegacyResponseData) : data.series;
    const queryHints = datasource.getQueryHints(query, result);
    let queryHint = queryHints.length > 0 ? queryHints[0] : null;

    setHint(queryHint ?? initHint);
  }, [data, datasource, query]);

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

  // Use our custom effects hook
  usePromQueryFieldEffects(languageProvider, range, data?.series, refreshMetrics, refreshHint);

  const { chooserText, buttonDisabled } = useMetricsState(datasource, languageProvider, syntaxLoaded);

  return (
    <>
      <div
        className="gf-form-inline gf-form-inline--xs-view-flex-column flex-grow-1"
        data-testid={props['data-testid']}
      >
        <button
          className="gf-form-label query-keyword pointer"
          onClick={onClickChooserButton}
          disabled={buttonDisabled}
          type="button"
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.openButton}
        >
          {chooserText}
          <Icon name={labelBrowserVisible ? 'angle-down' : 'angle-right'} />
        </button>

        <div className="flex-grow-1 min-width-15">
          <MonacoQueryFieldWrapper
            languageProvider={languageProvider}
            history={history}
            onChange={onChangeQuery}
            onRunQuery={onRunQuery}
            initialValue={query.expr ?? ''}
            placeholder="Enter a PromQL query…"
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
