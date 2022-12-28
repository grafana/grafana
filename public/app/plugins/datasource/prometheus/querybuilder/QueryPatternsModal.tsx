import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React, { useMemo, useState } from 'react';

import { CoreApp, DataQuery, GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, Collapse, Modal, useStyles2 } from '@grafana/ui';
import { getNextRefIdChar } from 'app/core/utils/query';

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
  const hasPreviousQuery = useMemo(
    () => buildVisualQueryFromString(query.expr).query.operations.length > 0,
    [query.expr]
  );

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
        refId: getNextRefIdChar(queries ?? [query]),
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
    <Modal isOpen={isOpen} title="Kick start your query" onDismiss={onClose}>
      <div className={styles.spacing}>
        Kick start your query by selecting one of these queries. You can then continue to complete your query.
      </div>
      {Object.values(PromQueryPatternType).map((patternType) => {
        return (
          <Collapse
            key={patternType}
            label={`${capitalize(patternType)} query starters`}
            isOpen={openTabs.includes(patternType)}
            collapsible={true}
            onToggle={() =>
              setOpenTabs((tabs) =>
                // close tab if it's already open, otherwise open it
                tabs.includes(patternType) ? tabs.filter((t) => t !== patternType) : [...tabs, patternType]
              )
            }
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
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cardsContainer: css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
    `,
    spacing: css`
      margin-bottom: ${theme.spacing(1)};
    `,
  };
};
