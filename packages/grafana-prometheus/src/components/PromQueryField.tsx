// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PromQueryField.tsx
import { css, cx } from '@emotion/css';
import { ReactNode, useCallback, useEffect, useRef, useReducer } from 'react';

import {
  DateTime,
  isDataFrame,
  LocalStorageValueProvider,
  QueryEditorProps,
  QueryHint,
  toLegacyResponseData,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { clearButtonStyles, Icon, useTheme2 } from '@grafana/ui';

import { PrometheusDatasource } from '../datasource';
import { roundMsToMin } from '../language_utils';
import { getInitHints } from '../query_hints';
import { PromOptions, PromQuery } from '../types';

import { PrometheusMetricsBrowser } from './PrometheusMetricsBrowser';
import { CancelablePromise, isCancelablePromiseRejection, makePromiseCancelable } from './cancelable-promise';
import { MonacoQueryFieldWrapper } from './monaco-query-field/MonacoQueryFieldWrapper';
import { useMetricsState } from './useMetricsState';

const LAST_USED_LABELS_KEY = 'grafana.datasources.prometheus.browser.labels';

interface PromQueryFieldProps extends QueryEditorProps<PrometheusDatasource, PromQuery, PromOptions> {
  ExtraFieldElement?: ReactNode;
  'data-testid'?: string;
}

interface PromQueryFieldState {
  syntaxLoaded: boolean;
  hint: QueryHint | null;
  labelBrowserVisible: boolean;
}

type PromQueryFieldAction =
  | { type: 'DATASOURCE_CHANGED' }
  | { type: 'METRICS_LOADING_STARTED' }
  | { type: 'METRICS_LOADING_FINISHED' }
  | { type: 'SET_HINT'; hint: QueryHint | null }
  | { type: 'TOGGLE_LABEL_BROWSER'; visible?: boolean };

const reducer = (state: PromQueryFieldState, action: PromQueryFieldAction): PromQueryFieldState => {
  switch (action.type) {
    case 'DATASOURCE_CHANGED':
      return {
        ...state,
        syntaxLoaded: false,
        hint: null,
      };
    case 'METRICS_LOADING_STARTED':
      return {
        ...state,
      };
    case 'METRICS_LOADING_FINISHED':
      return {
        ...state,
        syntaxLoaded: true,
      };
    case 'SET_HINT':
      return {
        ...state,
        hint: action.hint,
      };
    case 'TOGGLE_LABEL_BROWSER':
      return {
        ...state,
        labelBrowserVisible: action.visible !== undefined ? action.visible : !state.labelBrowserVisible,
      };
    default:
      return state;
  }
};

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
  const lastRangeRef = useRef<{ from: DateTime; to: DateTime } | null>(null);
  const languageProviderInitRef = useRef<CancelablePromise<any> | null>(null);

  const [state, dispatch] = useReducer(reducer, {
    syntaxLoaded: false,
    hint: null,
    labelBrowserVisible: false,
  });

  const onUpdateLanguage = useCallback(() => {
    if (languageProvider.metrics) {
      dispatch({ type: 'METRICS_LOADING_FINISHED' });
    }
  }, [languageProvider]);

  const refreshMetrics = useCallback(async () => {
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

      dispatch({ type: 'METRICS_LOADING_STARTED' });

      const remainingTasks = await initialization.promise;

      // If there are remaining tasks, wait for them
      if (Array.isArray(remainingTasks) && remainingTasks.length > 0) {
        await Promise.all(remainingTasks);
      }

      onUpdateLanguage();
    } catch (err) {
      if (isCancelablePromiseRejection(err) && err.isCanceled) {
        // do nothing, promise was canceled
      } else {
        throw err;
      }
    } finally {
      languageProviderInitRef.current = null;
    }
  }, [languageProvider, range, onUpdateLanguage]);

  const refreshHint = useCallback(() => {
    const initHints = getInitHints(datasource);
    const initHint = initHints[0] ?? null;

    // If no data or empty series, use default hint
    if (!data?.series?.length) {
      dispatch({ type: 'SET_HINT', hint: initHint });
      return;
    }

    const result = isDataFrame(data.series[0]) ? data.series.map(toLegacyResponseData) : data.series;
    const queryHints = datasource.getQueryHints(query, result);
    let queryHint = queryHints.length > 0 ? queryHints[0] : null;

    dispatch({ type: 'SET_HINT', hint: queryHint ?? initHint });
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
    dispatch({ type: 'TOGGLE_LABEL_BROWSER', visible: false });
  };

  const onClickChooserButton = () => {
    dispatch({ type: 'TOGGLE_LABEL_BROWSER' });

    reportInteraction('user_grafana_prometheus_metrics_browser_clicked', {
      editorMode: state.labelBrowserVisible ? 'metricViewClosed' : 'metricViewOpen',
      app: app ?? '',
    });
  };

  const onClickHintFix = () => {
    if (state.hint?.fix?.action) {
      onChange(datasource.modifyQuery(query, state.hint.fix.action));
    }
    onRunQuery();
  };

  // Effect for initial load
  useEffect(() => {
    if (languageProvider) {
      refreshMetrics();
    }
    refreshHint();

    return () => {
      if (languageProviderInitRef.current) {
        languageProviderInitRef.current.cancel();
        languageProviderInitRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect for time range changes
  useEffect(() => {
    if (!range) {
      return;
    }

    const currentFrom = roundMsToMin(range.from.valueOf());
    const currentTo = roundMsToMin(range.to.valueOf());

    if (!lastRangeRef.current) {
      lastRangeRef.current = { from: range.from, to: range.to };
      refreshMetrics();
      return;
    }

    const lastFrom = roundMsToMin(lastRangeRef.current.from.valueOf());
    const lastTo = roundMsToMin(lastRangeRef.current.to.valueOf());

    if (currentFrom !== lastFrom || currentTo !== lastTo) {
      lastRangeRef.current = { from: range.from, to: range.to };
      refreshMetrics();
    }
  }, [range, refreshMetrics]);

  // Effect for data changes (refreshing hints)
  useEffect(() => {
    refreshHint();
  }, [data?.series, refreshHint]);

  const { chooserText, buttonDisabled } = useMetricsState(datasource, languageProvider, state.syntaxLoaded);

  return (
    <LocalStorageValueProvider<string[]> storageKey={LAST_USED_LABELS_KEY} defaultValue={[]}>
      {(lastUsedLabels, onLastUsedLabelsSave, onLastUsedLabelsDelete) => {
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
                <Icon name={state.labelBrowserVisible ? 'angle-down' : 'angle-right'} />
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
                />
              </div>
            </div>
            {state.labelBrowserVisible && (
              <div className="gf-form">
                <PrometheusMetricsBrowser
                  languageProvider={languageProvider}
                  onChange={onChangeLabelBrowser}
                  lastUsedLabels={lastUsedLabels || []}
                  storeLastUsedLabels={onLastUsedLabelsSave}
                  deleteLastUsedLabels={onLastUsedLabelsDelete}
                  timeRange={range}
                />
              </div>
            )}
            {ExtraFieldElement}
            {state.hint ? (
              <div
                className={css({
                  flexBasis: '100%',
                })}
              >
                <div className="text-warning">
                  {state.hint.label}{' '}
                  {state.hint.fix ? (
                    <button
                      type="button"
                      className={cx(clearButtonStyles(theme), 'text-link', 'muted')}
                      onClick={onClickHintFix}
                    >
                      {state.hint.fix.label}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        );
      }}
    </LocalStorageValueProvider>
  );
};
