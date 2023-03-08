import { css } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2, LogRowModel, SelectableValue } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { LoadingPlaceholder, MultiSelect, Tag, Tooltip, useStyles2 } from '@grafana/ui';

import LokiLanguageProvider from '../LanguageProvider';
import { ContextFilter } from '../types';

export interface LokiContextUiProps {
  languageProvider: LokiLanguageProvider;
  row: LogRowModel;
  updateFilter: (value: ContextFilter[]) => void;
  onClose: () => void;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    labels: css`
      display: flex;
      gap: 2px;
    `,
    multiSelectWrapper: css`
      display: flex;
      flex-direction: column;
      flex: 1;
      margin-top: ${theme.spacing(1)};
      gap: ${theme.spacing(0.5)};
    `,
    multiSelect: css`
      & .scrollbar-view {
        overscroll-behavior: contain;
      }
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
  };
}

const formatOptionLabel = memoizeOne(({ label, description }: SelectableValue<string>) => (
  <Tooltip content={`${label}="${description}"`} placement="top" interactive={true}>
    <span>{label}</span>
  </Tooltip>
));

export function LokiContextUi(props: LokiContextUiProps) {
  const { row, languageProvider, updateFilter, onClose } = props;
  const styles = useStyles2(getStyles);

  const [contextFilters, setContextFilters] = useState<ContextFilter[]>([]);

  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
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
      updateFilter(contextFilters);
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
    await languageProvider.start();
    const allLabels = languageProvider.getLabelKeys();
    const contextFilters: ContextFilter[] = [];

    Object.entries(row.labels).forEach(([label, value]) => {
      const filter: ContextFilter = {
        label,
        value: label, // this looks weird in the first place, but we need to set the label as value here
        enabled: allLabels.includes(label),
        fromParser: !allLabels.includes(label),
        description: value,
      };
      contextFilters.push(filter);
    });

    setContextFilters(contextFilters);
    setInitialized(true);
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
    <div className={styles.multiSelectWrapper}>
      <div className={styles.textWrapper}>
        {' '}
        <Tooltip
          content={
            'This feature is experimental and only works on log queries containing no more than 1 parser (logfmt, json).'
          }
          placement="top"
        >
          <Tag
            className={css({
              fontSize: 10,
              padding: '1px 5px',
              verticalAlign: 'text-bottom',
            })}
            name={'Experimental'}
            colorIndex={1}
          />
        </Tooltip>{' '}
        Select labels to be included in the context query:
        <LoadingPlaceholder text="" className={`${styles.loadingPlaceholder} ${loading ? '' : styles.hidden}`} />
      </div>
      <div>
        <MultiSelect
          className={styles.multiSelect}
          prefix="Labels"
          options={realLabels}
          value={realLabelsEnabled}
          formatOptionLabel={formatOptionLabel}
          closeMenuOnSelect={true}
          maxMenuHeight={200}
          menuShouldPortal={false}
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
                filter.enabled = keys.some((key) => key.value === filter.value);
                return filter;
              })
            );
          }}
        />
      </div>
      {parsedLabels.length > 0 && (
        <div>
          <MultiSelect
            className={styles.multiSelect}
            prefix="Parsed Labels"
            options={parsedLabels}
            value={parsedLabelsEnabled}
            formatOptionLabel={formatOptionLabel}
            closeMenuOnSelect={true}
            menuShouldPortal={false}
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
                  filter.enabled = keys.some((key) => key.value === filter.value);
                  return filter;
                })
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
