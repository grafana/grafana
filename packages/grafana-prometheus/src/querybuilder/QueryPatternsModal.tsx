// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/QueryPatternsModal.tsx
import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import { useMemo, useState } from 'react';

import { CoreApp, DataQuery, getNextRefId, GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, Collapse, Modal, useStyles2 } from '@grafana/ui';

import { PromQuery } from '../types';

import { promQueryModeller } from './PromQueryModeller';
import { QueryPattern } from './QueryPattern';
import { buildVisualQueryFromString } from './parsing';
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

    visualQuery.query.operations = pattern.operations;
    visualQuery.query.binaryQueries = pattern.binaryQueries;
    if (hasNewQueryOption && selectAsNewQuery) {
      onAddQuery({
        ...query,
        refId: getNextRefId(queries ?? [query]),
        expr: promQueryModeller.renderQuery(visualQuery.query),
      });
    } else {
      onChange({
        ...query,
        expr: promQueryModeller.renderQuery(visualQuery.query),
      });
    }
    setSelectedPatternName(null);
    onClose();
  };

  return (
    <Modal aria-label="Kick start your query modal" isOpen={isOpen} title="Kick start your query" onDismiss={onClose}>
      <div className={styles.spacing}>
        Kick start your query by selecting one of these queries. You can then continue to complete your query.
      </div>
      {Object.values(PromQueryPatternType).map((patternType) => {
        const isOpen = openTabs.includes(patternType);
        return (
          <Collapse
            aria-label={`open and close ${patternType} query starter card`}
            key={patternType}
            label={`${capitalize(patternType)} query starters`}
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
            <div className={styles.cardsContainer}>
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
            </div>
          </Collapse>
        );
      })}
      <Button aria-label="close kick start your query modal" variant="secondary" onClick={onClose}>
        Close
      </Button>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cardsContainer: css({
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    }),
    spacing: css({
      marginBottom: theme.spacing(1),
    }),
  };
};
