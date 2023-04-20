import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2, LogRowModel, SelectableValue } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Collapse, Icon, Label, LoadingPlaceholder, MultiSelect, Tag, Tooltip, useStyles2 } from '@grafana/ui';
import store from 'app/core/store';

import { RawQuery } from '../../prometheus/querybuilder/shared/RawQuery';
import { LogContextProvider } from '../LogContextProvider';
import { escapeLabelValueInSelector } from '../languageUtils';
import { isQueryWithParser } from '../queryUtils';
import { lokiGrammar } from '../syntax';
import { ContextFilter, LokiQuery } from '../types';

export interface LokiContextUiProps {
  logContextProvider: LogContextProvider;
  row: LogRowModel;
  updateFilter: (value: ContextFilter[]) => void;
  onClose: () => void;
  origQuery?: LokiQuery;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    labels: css`
      display: flex;
      gap: ${theme.spacing(0.5)};
    `,
    wrapper: css`
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: ${theme.spacing(0.5)};
    `,
    loadingPlaceholder: css`
      margin-bottom: 0px;
      float: right;
      display: inline;
      margin-left: auto;
    `,
    textWrapper: css`
      display: flex;
      align-items: center;
    `,
    hidden: css`
      visibility: hidden;
    `,
    tag: css`
      padding: ${theme.spacing(0.25)} ${theme.spacing(0.75)};
    `,
    label: css`
      max-width: 100%;
      margin: ${theme.spacing(2)} 0;
    `,
    query: css`
      text-align: start;
      line-break: anywhere;
      margin-top: -${theme.spacing(0.25)};
    `,
    ui: css`
      background-color: ${theme.colors.background.secondary};
      padding: ${theme.spacing(2)};
    `,
    rawQuery: css`
      display: inline;
    `,
    queryDescription: css`
      margin-left: ${theme.spacing(0.5)};
    `,
  };
}

const IS_LOKI_LOG_CONTEXT_UI_OPEN = 'isLogContextQueryUiOpen';

export function LokiContextUi(props: LokiContextUiProps) {
  const { row, logContextProvider, updateFilter, onClose, origQuery } = props;
  const styles = useStyles2(getStyles);

  const [contextFilters, setContextFilters] = useState<ContextFilter[]>([]);

  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(store.getBool(IS_LOKI_LOG_CONTEXT_UI_OPEN, true));

  const timerHandle = React.useRef<number>();
  const previousInitialized = React.useRef<boolean>(false);
  const previousContextFilters = React.useRef<ContextFilter[]>([]);
  useEffect(() => {
    if (!initialized) {
      return;
    }

    // don't trigger if we initialized, this will be the same query anyways.
    if (!previousInitialized.current) {
      previousInitialized.current = initialized;
      return;
    }

    if (contextFilters.filter(({ enabled, fromParser }) => enabled && !fromParser).length === 0) {
      setContextFilters(previousContextFilters.current);
      return;
    }

    previousContextFilters.current = structuredClone(contextFilters);

    if (timerHandle.current) {
      clearTimeout(timerHandle.current);
    }
    setLoading(true);
    timerHandle.current = window.setTimeout(() => {
      updateFilter(contextFilters.filter(({ enabled }) => enabled));
      setLoading(false);
    }, 1500);

    return () => {
      clearTimeout(timerHandle.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextFilters, initialized]);

  useEffect(() => {
    return () => {
      clearTimeout(timerHandle.current);
      onClose();
    };
  }, [onClose]);

  useAsync(async () => {
    setLoading(true);
    const contextFilters = await logContextProvider.getInitContextFiltersFromLabels(row.labels);
    setContextFilters(contextFilters);
    setInitialized(true);
    setLoading(false);
  });

  useEffect(() => {
    reportInteraction('grafana_explore_logs_loki_log_context_loaded', {
      logRowUid: row.uid,
      type: 'load',
    });

    return () => {
      reportInteraction('grafana_explore_logs_loki_log_context_loaded', {
        logRowUid: row.uid,
        type: 'unload',
      });
    };
  }, [row.uid]);

  const realLabels = contextFilters.filter(({ fromParser }) => !fromParser);
  const realLabelsEnabled = realLabels.filter(({ enabled }) => enabled);

  const parsedLabels = contextFilters.filter(({ fromParser }) => fromParser);
  const parsedLabelsEnabled = parsedLabels.filter(({ enabled }) => enabled);

  const contextFilterToSelectFilter = useCallback((contextFilter: ContextFilter): SelectableValue<string> => {
    return {
      label: `${contextFilter.label}="${escapeLabelValueInSelector(contextFilter.value)}"`,
      value: contextFilter.label,
    };
  }, []);

  // Currently we support adding of parser and showing parsed labels only if there is 1 parser
  const showParsedLabels = origQuery && isQueryWithParser(origQuery.expr).parserCount === 1 && parsedLabels.length > 0;

  return (
    <div className={styles.wrapper}>
      <Collapse
        collapsible={true}
        isOpen={isOpen}
        onToggle={() => {
          store.set(IS_LOKI_LOG_CONTEXT_UI_OPEN, !isOpen);
          setIsOpen((isOpen) => !isOpen);
        }}
        label={
          <div className={styles.query}>
            <RawQuery
              lang={{ grammar: lokiGrammar, name: 'loki' }}
              query={logContextProvider.processContextFiltersToExpr(
                row,
                contextFilters.filter(({ enabled }) => enabled),
                origQuery
              )}
              className={styles.rawQuery}
            />
            <Tooltip content="Initially executed log context query is created from all labels defining the stream for the selected log line. Use editor bellow to customize log context query.">
              <Icon name="info-circle" size="sm" className={styles.queryDescription} />
            </Tooltip>
          </div>
        }
      >
        <div className={styles.ui}>
          <Tooltip
            content={
              'This feature is experimental and may change in the future. Currently it supports using parser and extracted labels for queries with no more than 1 parser (e.g. logfmt, json). Please report any issues in the Grafana GitHub repository.'
            }
            placement="top"
          >
            <Tag className={styles.tag} name={'Experimental feature'} colorIndex={1} />
          </Tooltip>{' '}
          <Label
            className={styles.label}
            description="By removing some of the selected label filters, you can broaden your search."
          >
            Widen the search
          </Label>
          <MultiSelect
            isLoading={loading}
            options={realLabels.map(contextFilterToSelectFilter)}
            value={realLabelsEnabled.map(contextFilterToSelectFilter)}
            closeMenuOnSelect={true}
            maxMenuHeight={200}
            noOptionsMessage="No further labels available"
            onChange={(keys, actionMeta) => {
              if (actionMeta.action === 'select-option') {
                reportInteraction('grafana_explore_logs_loki_log_context_filtered', {
                  logRowUid: row.uid,
                  type: 'label',
                  action: 'select',
                });
              }
              if (actionMeta.action === 'remove-value') {
                reportInteraction('grafana_explore_logs_loki_log_context_filtered', {
                  logRowUid: row.uid,
                  type: 'label',
                  action: 'remove',
                });
              }
              return setContextFilters(
                contextFilters.map((filter) => {
                  if (filter.fromParser) {
                    return filter;
                  }
                  filter.enabled = keys.some((key) => key.value === filter.label);
                  return filter;
                })
              );
            }}
          />
          {showParsedLabels && (
            <>
              <Label
                className={styles.label}
                description={`By using parser in your original query, you are able to filter for extracted labels. Refine your search by applying extracted labels from selected log line.`}
              >
                Refine the search
              </Label>
              <MultiSelect
                isLoading={loading}
                options={parsedLabels.map(contextFilterToSelectFilter)}
                value={parsedLabelsEnabled.map(contextFilterToSelectFilter)}
                closeMenuOnSelect={true}
                maxMenuHeight={200}
                noOptionsMessage="No further labels available"
                isClearable={true}
                onChange={(keys, actionMeta) => {
                  if (actionMeta.action === 'select-option') {
                    reportInteraction('grafana_explore_logs_loki_log_context_filtered', {
                      logRowUid: row.uid,
                      type: 'parsed_label',
                      action: 'select',
                    });
                  }
                  if (actionMeta.action === 'remove-value') {
                    reportInteraction('grafana_explore_logs_loki_log_context_filtered', {
                      logRowUid: row.uid,
                      type: 'parsed_label',
                      action: 'remove',
                    });
                  }
                  setContextFilters(
                    contextFilters.map((filter) => {
                      if (!filter.fromParser) {
                        return filter;
                      }
                      filter.enabled = keys.some((key) => key.value === filter.label);
                      return filter;
                    })
                  );
                }}
              />
            </>
          )}
        </div>
      </Collapse>
    </div>
  );
}
