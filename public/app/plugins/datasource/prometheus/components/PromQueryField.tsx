import { LanguageMap, languages as prismLanguages } from 'prismjs';
import React, { ReactNode } from 'react';
import { Plugin } from 'slate';
import { Editor } from 'slate-react';

import { CoreApp, isDataFrame, QueryEditorProps, QueryHint, TimeRange, toLegacyResponseData } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime/src';
import {
  BracesPlugin,
  DOMUtil,
  Icon,
  SlatePrism,
  SuggestionsState,
  TypeaheadInput,
  TypeaheadOutput,
} from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
import {
  CancelablePromise,
  isCancelablePromiseRejection,
  makePromiseCancelable,
} from 'app/core/utils/CancelablePromise';

import { PrometheusDatasource } from '../datasource';
import { roundMsToMin } from '../language_utils';
import { PromOptions, PromQuery } from '../types';

import { PrometheusMetricsBrowser } from './PrometheusMetricsBrowser';
import { MonacoQueryFieldWrapper } from './monaco-query-field/MonacoQueryFieldWrapper';

export const RECORDING_RULES_GROUP = '__recording_rules__';
const LAST_USED_LABELS_KEY = 'grafana.datasources.prometheus.browser.labels';

function getChooserText(metricsLookupDisabled: boolean, hasSyntax: boolean, hasMetrics: boolean) {
  if (metricsLookupDisabled) {
    return '(Disabled)';
  }

  if (!hasSyntax) {
    return 'Loading metrics...';
  }

  if (!hasMetrics) {
    return '(No metrics found)';
  }

  return 'Metrics browser';
}

export function willApplySuggestion(suggestion: string, { typeaheadContext, typeaheadText }: SuggestionsState): string {
  // Modify suggestion based on context
  switch (typeaheadContext) {
    case 'context-labels': {
      const nextChar = DOMUtil.getNextCharacter();
      if (!nextChar || nextChar === '}' || nextChar === ',') {
        suggestion += '=';
      }
      break;
    }

    case 'context-label-values': {
      // Always add quotes and remove existing ones instead
      if (!typeaheadText.match(/^(!?=~?"|")/)) {
        suggestion = `"${suggestion}`;
      }
      if (DOMUtil.getNextCharacter() !== '"') {
        suggestion = `${suggestion}"`;
      }
      break;
    }

    default:
  }
  return suggestion;
}

interface PromQueryFieldProps extends QueryEditorProps<PrometheusDatasource, PromQuery, PromOptions> {
  ExtraFieldElement?: ReactNode;
  'data-testid'?: string;
}

interface PromQueryFieldState {
  labelBrowserVisible: boolean;
  syntaxLoaded: boolean;
  hint: QueryHint | null;
}

class PromQueryField extends React.PureComponent<PromQueryFieldProps, PromQueryFieldState> {
  plugins: Array<Plugin<Editor>>;
  declare languageProviderInitializationPromise: CancelablePromise<any>;

  constructor(props: PromQueryFieldProps, context: React.Context<any>) {
    super(props, context);

    this.plugins = [
      BracesPlugin(),
      SlatePrism(
        {
          onlyIn: (node: any) => node.type === 'code_block',
          getSyntax: (node: any) => 'promql',
        },
        { ...(prismLanguages as LanguageMap), promql: this.props.datasource.languageProvider.syntax }
      ),
    ];

    this.state = {
      labelBrowserVisible: false,
      syntaxLoaded: false,
      hint: null,
    };
  }

  componentDidMount() {
    if (this.props.datasource.languageProvider) {
      this.refreshMetrics();
    }
    this.refreshHint();
  }

  componentWillUnmount() {
    if (this.languageProviderInitializationPromise) {
      this.languageProviderInitializationPromise.cancel();
    }
  }

  componentDidUpdate(prevProps: PromQueryFieldProps) {
    const {
      data,
      datasource: { languageProvider },
      range,
    } = this.props;

    if (languageProvider !== prevProps.datasource.languageProvider) {
      // We reset this only on DS change so we do not flesh loading state on every rangeChange which happens on every
      // query run if using relative range.
      this.setState({
        syntaxLoaded: false,
      });
    }

    const changedRangeToRefresh = this.rangeChangedToRefresh(range, prevProps.range);
    // We want to refresh metrics when language provider changes and/or when range changes (we round up intervals to a minute)
    if (languageProvider !== prevProps.datasource.languageProvider || changedRangeToRefresh) {
      this.refreshMetrics();
    }

    if (data && prevProps.data && prevProps.data.series !== data.series) {
      this.refreshHint();
    }
  }

  refreshHint = () => {
    const { datasource, query, data } = this.props;
    const initHints = datasource.getInitHints();
    const initHint = initHints.length > 0 ? initHints[0] : null;

    if (!data || data.series.length === 0) {
      this.setState({
        hint: initHint,
      });
      return;
    }

    const result = isDataFrame(data.series[0]) ? data.series.map(toLegacyResponseData) : data.series;
    const queryHints = datasource.getQueryHints(query, result);
    let queryHint = queryHints.length > 0 ? queryHints[0] : null;

    this.setState({ hint: queryHint ?? initHint });
  };

  refreshMetrics = async () => {
    const {
      datasource: { languageProvider },
    } = this.props;

    this.languageProviderInitializationPromise = makePromiseCancelable(languageProvider.start());

    try {
      const remainingTasks = await this.languageProviderInitializationPromise.promise;
      await Promise.all(remainingTasks);
      this.onUpdateLanguage();
    } catch (err) {
      if (isCancelablePromiseRejection(err) && err.isCanceled) {
        // do nothing, promise was canceled
      } else {
        throw err;
      }
    }
  };

  rangeChangedToRefresh(range?: TimeRange, prevRange?: TimeRange): boolean {
    if (range && prevRange) {
      const sameMinuteFrom = roundMsToMin(range.from.valueOf()) === roundMsToMin(prevRange.from.valueOf());
      const sameMinuteTo = roundMsToMin(range.to.valueOf()) === roundMsToMin(prevRange.to.valueOf());
      // If both are same, don't need to refresh.
      return !(sameMinuteFrom && sameMinuteTo);
    }
    return false;
  }

  /**
   * TODO #33976: Remove this, add histogram group (query = `histogram_quantile(0.95, sum(rate(${metric}[5m])) by (le))`;)
   */
  onChangeLabelBrowser = (selector: string) => {
    this.onChangeQuery(selector, true);
    this.setState({ labelBrowserVisible: false });
  };

  onChangeQuery = (value: string, override?: boolean) => {
    // Send text change to parent
    const { query, onChange, onRunQuery } = this.props;
    if (onChange) {
      const nextQuery: PromQuery = { ...query, expr: value };
      onChange(nextQuery);

      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  };

  onClickChooserButton = () => {
    this.setState((state) => ({ labelBrowserVisible: !state.labelBrowserVisible }));

    reportInteraction('user_grafana_prometheus_metrics_browser_clicked', {
      editorMode: this.state.labelBrowserVisible ? 'metricViewClosed' : 'metricViewOpen',
      app: this.props?.app ?? '',
    });
  };

  onClickHintFix = () => {
    const { datasource, query, onChange, onRunQuery } = this.props;
    const { hint } = this.state;
    if (hint?.fix?.action) {
      onChange(datasource.modifyQuery(query, hint.fix.action));
    }
    onRunQuery();
  };

  onUpdateLanguage = () => {
    const {
      datasource: { languageProvider },
    } = this.props;
    const { metrics } = languageProvider;

    if (!metrics) {
      return;
    }

    this.setState({ syntaxLoaded: true });
  };

  onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const {
      datasource: { languageProvider },
    } = this.props;

    if (!languageProvider) {
      return { suggestions: [] };
    }

    const { history } = this.props;
    const { prefix, text, value, wrapperClasses, labelKey } = typeahead;

    const result = await languageProvider.provideCompletionItems(
      { text, value, prefix, wrapperClasses, labelKey },
      { history }
    );

    return result;
  };

  render() {
    const {
      datasource,
      datasource: { languageProvider },
      query,
      ExtraFieldElement,
      history = [],
    } = this.props;

    const { labelBrowserVisible, syntaxLoaded, hint } = this.state;
    const hasMetrics = languageProvider.metrics.length > 0;
    const chooserText = getChooserText(datasource.lookupsDisabled, syntaxLoaded, hasMetrics);
    const buttonDisabled = !(syntaxLoaded && hasMetrics);

    return (
      <LocalStorageValueProvider<string[]> storageKey={LAST_USED_LABELS_KEY} defaultValue={[]}>
        {(lastUsedLabels, onLastUsedLabelsSave, onLastUsedLabelsDelete) => {
          return (
            <>
              <div
                className="gf-form-inline gf-form-inline--xs-view-flex-column flex-grow-1"
                data-testid={this.props['data-testid']}
              >
                <button
                  className="gf-form-label query-keyword pointer"
                  onClick={this.onClickChooserButton}
                  disabled={buttonDisabled}
                >
                  {chooserText}
                  <Icon name={labelBrowserVisible ? 'angle-down' : 'angle-right'} />
                </button>

                <div className="gf-form gf-form--grow flex-shrink-1 min-width-15">
                  <MonacoQueryFieldWrapper
                    runQueryOnBlur={this.props.app !== CoreApp.Explore}
                    languageProvider={languageProvider}
                    history={history}
                    onChange={this.onChangeQuery}
                    onRunQuery={this.props.onRunQuery}
                    initialValue={query.expr ?? ''}
                    placeholder="Enter a PromQL query…"
                  />
                </div>
              </div>
              {labelBrowserVisible && (
                <div className="gf-form">
                  <PrometheusMetricsBrowser
                    languageProvider={languageProvider}
                    onChange={this.onChangeLabelBrowser}
                    lastUsedLabels={lastUsedLabels || []}
                    storeLastUsedLabels={onLastUsedLabelsSave}
                    deleteLastUsedLabels={onLastUsedLabelsDelete}
                  />
                </div>
              )}

              {ExtraFieldElement}
              {hint ? (
                <div className="query-row-break">
                  <div className="prom-query-field-info text-warning">
                    {hint.label}{' '}
                    {hint.fix ? (
                      <a className="text-link muted" onClick={this.onClickHintFix}>
                        {hint.fix.label}
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          );
        }}
      </LocalStorageValueProvider>
    );
  }
}

export default PromQueryField;
