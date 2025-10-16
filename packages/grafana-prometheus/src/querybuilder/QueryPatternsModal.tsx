// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/QueryPatternsModal.tsx
import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import { useMemo, useState } from 'react';

import { CoreApp, DataQuery, getNextRefId, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, Collapse, Modal, Stack, useStyles2 } from '@grafana/ui';

import { PromQuery } from '../types';

import { QueryPattern } from './QueryPattern';
import { buildVisualQueryFromString } from './parsing';
import { promQueryModeller } from './shared/modeller_instance';
import { PromQueryPattern, PromQueryPatternType } from './types';

type Props = {
  isOpen: boolean;
  query: PromQuery;
  queries: DataQuery[] | undefined;
  app?: CoreApp;
  onClose: () => void;
  onChange: (query: PromQuery) => void;
  onAddQuery?: (query: PromQuery) => void;
};

export const QueryPatternsModal = (props: Props) => {
  const { isOpen, onClose, onChange, onAddQuery, query, queries, app } = props;
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [selectedPatternName, setSelectedPatternName] = useState<string | null>(null);

  const styles = useStyles2(getStyles);
  const hasNewQueryOption = !!onAddQuery;
  const hasPreviousQuery = useMemo(() => {
    const visualQuery = buildVisualQueryFromString(query.expr ?? '');
    // has anything entered in the query, metric, labels, operations, or binary queries
    const hasOperations = visualQuery.query.operations.length > 0,
      hasMetric = visualQuery.query.metric,
      hasLabels = visualQuery.query.labels.length > 0,
      hasBinaryQueries = visualQuery.query.binaryQueries ? visualQuery.query.binaryQueries.length > 0 : false;

    return hasOperations || hasMetric || hasLabels || hasBinaryQueries;
  }, [query.expr]);

  const onPatternSelect = (pattern: PromQueryPattern, selectAsNewQuery = false) => {
    const visualQuery = buildVisualQueryFromString(selectAsNewQuery ? '' : query.expr);
    reportInteraction('grafana_prom_kickstart_your_query_selected', {
      app: app ?? '',
      editorMode: query.editorMode,
      selectedPattern: pattern.name,
      preSelectedOperationsCount: visualQuery.query.operations.length,
      preSelectedLabelsCount: visualQuery.query.labels.length,
      createNewQuery: hasNewQueryOption && selectAsNewQuery,
    });

    // Apply the pattern operations before rendering the expression
    visualQuery.query.operations = pattern.operations;
    visualQuery.query.binaryQueries = pattern.binaryQueries;
    const renderedExpr = promQueryModeller.renderQuery(visualQuery.query);

    if (hasNewQueryOption && selectAsNewQuery) {
      onAddQuery({
        ...query,
        refId: getNextRefId(queries ?? [query]),
        expr: renderedExpr,
      });
    } else {
      onChange({
        ...query,
        expr: renderedExpr,
      });
    }
    setSelectedPatternName(null);
    onClose();
  };

  return (
    <Modal
      aria-label={t(
        'grafana-prometheus.querybuilder.query-patterns-modal.aria-label-kick-start-your-query-modal',
        'Kick start your query modal'
      )}
      isOpen={isOpen}
      title={t(
        'grafana-prometheus.querybuilder.query-patterns-modal.title-kick-start-your-query',
        'Kick start your query'
      )}
      onDismiss={onClose}
    >
      <div className={styles.spacing}>
        <Trans i18nKey="grafana-prometheus.querybuilder.query-patterns-modal.description-kick-start-your-query">
          Kick start your query by selecting one of these queries. You can then continue to complete your query.
        </Trans>
      </div>
      {Object.values(PromQueryPatternType).map((patternType) => {
        const isOpen = openTabs.includes(patternType);
        return (
          <Collapse
            aria-label={t(
              'grafana-prometheus.querybuilder.query-patterns-modal.aria-label-toggle-query-starter',
              'open and close {{patternType}} query starter card',
              { patternType }
            )}
            key={patternType}
            label={t(
              'grafana-prometheus.querybuilder.query-patterns-modal.label-toggle-query-starter',
              '{{patternType}} query starters',
              {
                patternType: capitalize(patternType),
              }
            )}
            isOpen={isOpen}
            collapsible={true}
            onToggle={() => {
              const action = isOpen ? 'close' : 'open';
              reportInteraction(`grafana_prom_kickstart_toggle_pattern_card`, {
                action,
                patternType,
              });

              setOpenTabs((tabs) =>
                // close tab if it's already open, otherwise open it
                tabs.includes(patternType) ? tabs.filter((t) => t !== patternType) : [...tabs, patternType]
              );
            }}
          >
            <Stack wrap justifyContent="space-between">
              {promQueryModeller
                .getQueryPatterns()
                .filter((pattern) => pattern.type === patternType)
                .map((pattern) => (
                  <QueryPattern
                    key={pattern.name}
                    pattern={pattern}
                    hasNewQueryOption={hasNewQueryOption}
                    hasPreviousQuery={hasPreviousQuery}
                    onPatternSelect={onPatternSelect}
                    selectedPatternName={selectedPatternName}
                    setSelectedPatternName={setSelectedPatternName}
                  />
                ))}
            </Stack>
          </Collapse>
        );
      })}
      <Button
        aria-label={t(
          'grafana-prometheus.querybuilder.query-patterns-modal.aria-label-close-kick-start-your-query-modal',
          'close kick start your query modal'
        )}
        variant="secondary"
        onClick={onClose}
      >
        <Trans i18nKey="grafana-prometheus.querybuilder.query-patterns-modal.close">Close</Trans>
      </Button>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    spacing: css({
      marginBottom: theme.spacing(1),
    }),
  };
};
