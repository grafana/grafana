import { css } from '@emotion/css';
import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { dateTime, GrafanaTheme2, LogRowModel, renderMarkdown, SelectableValue } from '@grafana/data';
import { RawQuery } from '@grafana/plugin-ui';
import { reportInteraction } from '@grafana/runtime';
import {
  Alert,
  Button,
  Collapse,
  Icon,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  Label,
  MultiSelect,
  RenderUserContentAsHTML,
  Spinner,
  Tooltip,
  useStyles2,
} from '@grafana/ui';

import {
  LogContextProvider,
  LOKI_LOG_CONTEXT_PRESERVED_LABELS,
  PreservedLabels,
  SHOULD_INCLUDE_PIPELINE_OPERATIONS,
} from '../LogContextProvider';
import { escapeLabelValueInSelector } from '../languageUtils';
import { lokiGrammar } from '../syntax';
import { ContextFilter, LokiQuery } from '../types';

export interface LokiContextUiProps {
  logContextProvider: LogContextProvider;
  row: LogRowModel;
  updateFilter: (value: ContextFilter[]) => void;
  onClose: () => void;
  origQuery?: LokiQuery;
  runContextQuery?: () => void;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    labels: css({
      display: 'flex',
      gap: theme.spacing(0.5),
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      gap: theme.spacing(0.5),
      position: 'relative',
    }),
    textWrapper: css({
      display: 'flex',
      alignItems: 'center',
    }),
    hidden: css({
      visibility: 'hidden',
    }),
    label: css({
      maxWidth: '100%',
      '&:first-of-type': {
        marginBottom: theme.spacing(2),
      },
      '&:not(:first-of-type)': {
        margin: theme.spacing(2, 0),
      },
    }),
    rawQueryContainer: css({
      textAlign: 'start',
      lineBreak: 'anywhere',
      marginTop: theme.spacing(-0.25),
      marginRight: theme.spacing(6),
      minHeight: theme.spacing(4),
    }),
    ui: css({
      backgroundColor: theme.colors.background.secondary,
      padding: theme.spacing(2),
    }),
    notification: css({
      position: 'absolute',
      zIndex: theme.zIndex.portal,
      top: 0,
      right: 0,
    }),
    rawQuery: css({
      display: 'inline',
    }),
    queryDescription: css({
      marginLeft: theme.spacing(0.5),
    }),
    iconButton: css({
      position: 'absolute',
      top: theme.spacing(1),
      right: theme.spacing(1),
      zIndex: theme.zIndex.navbarFixed,
    }),
    operationsToggle: css({
      margin: theme.spacing(1, 0, -1, 0),
      '& > div': {
        margin: 0,
        '& > label': {
          padding: 0,
        },
      },
    }),
  };
}

export const IS_LOKI_LOG_CONTEXT_UI_OPEN = 'isLogContextQueryUiOpen';

export function LokiContextUi(props: LokiContextUiProps) {
  const { row, logContextProvider, updateFilter, onClose, origQuery, runContextQuery } = props;
  const styles = useStyles2(getStyles);

  const [contextFilters, setContextFilters] = useState<ContextFilter[]>([]);
  const [showPreservedFiltersAppliedNotification, setShowPreservedFiltersAppliedNotification] = useState(false);

  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(window.localStorage.getItem(IS_LOKI_LOG_CONTEXT_UI_OPEN) === 'true');
  const [includePipelineOperations, setIncludePipelineOperations] = useState(
    window.localStorage.getItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS) === 'true'
  );

  const timerHandle = useRef<number>();
  const previousInitialized = useRef<boolean>(false);
  const previousContextFilters = useRef<ContextFilter[]>([]);

  const isInitialState = useMemo(() => {
    // Initial query has all regular labels enabled and all parsed labels disabled
    if (initialized && contextFilters.some((filter) => filter.nonIndexed === filter.enabled)) {
      return false;
    }

    // if we include pipeline operations, we also want to enable the revert button
    if (includePipelineOperations && logContextProvider.queryContainsValidPipelineStages(origQuery)) {
      return false;
    }

    return true;
  }, [contextFilters, includePipelineOperations, initialized, logContextProvider, origQuery]);

  useEffect(() => {
    if (!initialized) {
      return;
    }

    // don't trigger if we initialized, this will be the same query anyways.
    if (!previousInitialized.current) {
      previousInitialized.current = initialized;
      return;
    }

    if (contextFilters.filter(({ enabled, nonIndexed }) => enabled && !nonIndexed).length === 0) {
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
      // We are storing the removed labels and selected extracted labels in local storage so we can
      // preselect the labels in the UI in the next log context view.
      const preservedLabels: PreservedLabels = {
        removedLabels: [],
        selectedExtractedLabels: [],
      };

      contextFilters.forEach(({ enabled, nonIndexed, label }) => {
        // We only want to store real labels that were removed from the initial query
        if (!enabled && !nonIndexed) {
          preservedLabels.removedLabels.push(label);
        }
        // Or extracted labels that were added to the initial query
        if (enabled && nonIndexed) {
          preservedLabels.selectedExtractedLabels.push(label);
        }
      });

      window.localStorage.setItem(LOKI_LOG_CONTEXT_PRESERVED_LABELS, JSON.stringify(preservedLabels));
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
    const initContextFilters = await logContextProvider.getInitContextFilters(row, origQuery, {
      from: dateTime(row.timeEpochMs),
      to: dateTime(row.timeEpochMs),
      raw: { from: dateTime(row.timeEpochMs), to: dateTime(row.timeEpochMs) },
    });
    setContextFilters(initContextFilters.contextFilters);
    setShowPreservedFiltersAppliedNotification(initContextFilters.preservedFiltersApplied);
    setInitialized(true);
    setLoading(false);
  });

  // To hide previousContextFiltersApplied notification after 2 seconds
  useEffect(() => {
    if (showPreservedFiltersAppliedNotification) {
      setTimeout(() => {
        setShowPreservedFiltersAppliedNotification(false);
      }, 2000);
    }
  }, [showPreservedFiltersAppliedNotification]);

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

  const realLabels = contextFilters.filter(({ nonIndexed }) => !nonIndexed);
  const realLabelsEnabled = realLabels.filter(({ enabled }) => enabled);

  const parsedLabels = contextFilters.filter(({ nonIndexed }) => nonIndexed);
  const parsedLabelsEnabled = parsedLabels.filter(({ enabled }) => enabled);

  const contextFilterToSelectFilter = useCallback((contextFilter: ContextFilter): SelectableValue<string> => {
    return {
      label: `${contextFilter.label}="${escapeLabelValueInSelector(contextFilter.value)}"`,
      value: contextFilter.label,
    };
  }, []);

  // If there's any nonIndexed labels, that includes structured metadata and parsed labels, we show the nonIndexed labels input
  const showNonIndexedLabels = parsedLabels.length > 0;

  let queryExpr = logContextProvider.prepareExpression(
    contextFilters.filter(({ enabled }) => enabled),
    origQuery
  );
  return (
    <div className={styles.wrapper}>
      {showPreservedFiltersAppliedNotification && (
        <Alert
          className={styles.notification}
          title="Previously used filters have been applied."
          severity="info"
          elevated={true}
        ></Alert>
      )}
      <div className={styles.iconButton}>
        <Button
          tooltip="Revert to initial log context query"
          data-testid="revert-button"
          icon="history-alt"
          variant="secondary"
          disabled={isInitialState}
          onClick={(e) => {
            reportInteraction('grafana_explore_logs_loki_log_context_reverted', {
              logRowUid: row.uid,
            });
            setContextFilters((contextFilters) => {
              return contextFilters.map((contextFilter) => ({
                ...contextFilter,
                // For revert to initial query we need to enable all labels and disable all parsed labels
                enabled: !contextFilter.nonIndexed,
              }));
            });
            // We are removing the preserved labels from local storage so we can preselect the labels in the UI
            window.localStorage.removeItem(LOKI_LOG_CONTEXT_PRESERVED_LABELS);
            window.localStorage.removeItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS);
            setIncludePipelineOperations(false);
          }}
        />
      </div>

      <Collapse
        collapsible={true}
        isOpen={isOpen}
        onToggle={() => {
          window.localStorage.setItem(IS_LOKI_LOG_CONTEXT_UI_OPEN, (!isOpen).toString());
          setIsOpen((isOpen) => !isOpen);
          reportInteraction('grafana_explore_logs_loki_log_context_toggled', {
            logRowUid: row.uid,
            action: !isOpen ? 'open' : 'close',
          });
        }}
        label={
          <div className={styles.rawQueryContainer}>
            {initialized ? (
              <>
                <RawQuery
                  language={{ grammar: lokiGrammar, name: 'loki' }}
                  query={queryExpr}
                  className={styles.rawQuery}
                />
                <Tooltip content="The initial log context query is created from all labels defining the stream for the selected log line. Use the editor below to customize the log context query.">
                  <Icon name="info-circle" size="sm" className={styles.queryDescription} />
                </Tooltip>
              </>
            ) : (
              <Spinner />
            )}
          </div>
        }
      >
        <div className={styles.ui}>
          <Label
            className={styles.label}
            description="The initial log context query is created from all labels defining the stream for the selected log line. You can broaden your search by removing one or more of the label filters."
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
                  if (filter.nonIndexed) {
                    return filter;
                  }
                  filter.enabled = keys.some((key) => key.value === filter.label);
                  return filter;
                })
              );
            }}
          />
          {showNonIndexedLabels && (
            <>
              <Label
                className={styles.label}
                description={`By using a parser in your original query, you can use filters for extracted labels. Refine your search by applying extracted labels created from the selected log line.`}
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
                      if (!filter.nonIndexed) {
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
          {logContextProvider.queryContainsValidPipelineStages(origQuery) && (
            <InlineFieldRow className={styles.operationsToggle}>
              <InlineField
                label="Include LogQL pipeline operations"
                tooltip={
                  <RenderUserContentAsHTML
                    content={renderMarkdown(
                      "This will include LogQL operations such as `line_format` or `label_format`. It won't include line or label filter operations."
                    )}
                  />
                }
              >
                <InlineSwitch
                  value={includePipelineOperations}
                  showLabel={true}
                  transparent={true}
                  onChange={(e) => {
                    reportInteraction('grafana_explore_logs_loki_log_context_pipeline_toggled', {
                      logRowUid: row.uid,
                      action: e.currentTarget.checked ? 'enable' : 'disable',
                    });
                    window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, e.currentTarget.checked.toString());
                    setIncludePipelineOperations(e.currentTarget.checked);
                    if (runContextQuery) {
                      runContextQuery();
                    }
                  }}
                />
              </InlineField>
            </InlineFieldRow>
          )}
        </div>
      </Collapse>
    </div>
  );
}
