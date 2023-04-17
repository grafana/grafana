import { css } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2, LogRowModel, SelectableValue } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Collapse, Label, LoadingPlaceholder, MultiSelect, Tag, Tooltip, useStyles2 } from '@grafana/ui';

import { RawQuery } from '../../prometheus/querybuilder/shared/RawQuery';
import { LogContextProvider } from '../LogContextProvider';
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
    `,
  };
}

const formatOptionLabel = memoizeOne(({ label, value }: SelectableValue<string>) => (
  <span>{`${label}="${value}"`}</span>
));

export function LokiContextUi(props: LokiContextUiProps) {
  const { row, logContextProvider, updateFilter, onClose, origQuery } = props;
  const styles = useStyles2(getStyles);

  const [contextFilters, setContextFilters] = useState<ContextFilter[]>([]);

  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

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

  return (
    <div className={styles.wrapper}>
      <LoadingPlaceholder text="" className={`${styles.loadingPlaceholder} ${loading ? '' : styles.hidden}`} />
      <Collapse
        collapsible={true}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        label={
          <div>
            <RawQuery
              className={styles.query}
              lang={{ grammar: lokiGrammar, name: 'loki' }}
              query={logContextProvider.processContextFiltersToExpr(
                row,
                contextFilters.filter(({ enabled }) => enabled),
                origQuery
              )}
            />
          </div>
        }
      >
        <Tooltip
          content={
            'This feature is experimental and only works on log queries containing no more than 1 parser (logfmt, json).'
          }
          placement="top"
        >
          <Tag className={styles.tag} name={'Experimental feature'} colorIndex={1} />
        </Tooltip>{' '}
        <Label
          className={styles.label}
          description="Context query is created from all labels defining the stream for the selected log line. Select labels to be included in log context query."
        >
          1. Select labels
        </Label>
        <MultiSelect
          options={realLabels}
          value={realLabelsEnabled}
          formatOptionLabel={formatOptionLabel}
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
                filter.enabled = keys.some((key) => key.label === filter.label);
                return filter;
              })
            );
          }}
        />
        {parsedLabels.length > 0 && (
          <>
            <Label
              className={styles.label}
              description="By using logfmt parser, you are able to filter for extracted labels. Select extracted labels to be included in log context query."
            >
              2. Add extracted label filters
            </Label>
            <MultiSelect
              options={parsedLabels}
              value={parsedLabelsEnabled}
              formatOptionLabel={formatOptionLabel}
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
                    filter.enabled = keys.some((key) => key.label === filter.label);
                    return filter;
                  })
                );
              }}
            />
          </>
        )}
      </Collapse>
    </div>
  );
}
