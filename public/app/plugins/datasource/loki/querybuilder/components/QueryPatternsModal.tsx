import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React, { useMemo, useState } from 'react';

import { DataQuery, GrafanaTheme2 } from '@grafana/data';
import { Button, Collapse, Modal, useStyles2 } from '@grafana/ui';
import { getNextRefIdChar } from 'app/core/utils/query';

import { LokiQuery } from '../../types';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiQueryPattern, LokiQueryPatternType } from '../types';

import { QueryPatternsCard } from './QueryPatternsCard';

type Props = {
  isOpen: boolean;
  query: LokiQuery;
  queries: DataQuery[] | undefined;
  onClose: () => void;
  onChange: (query: LokiQuery) => void;
  onAddQuery?: (query: LokiQuery) => void;
};

export const QueryPatternsModal = (props: Props) => {
  const { isOpen, onClose, onChange, onAddQuery, query, queries } = props;
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [selectedPatternName, setSelectedPatternName] = useState<string | null>(null);

  const styles = useStyles2(getStyles);
  const hasNewQueryOption = !!onAddQuery;
  const hasPreviousQuery = useMemo(
    () => buildVisualQueryFromString(query.expr).query.operations.length > 0,
    [query.expr]
  );

  const onPatternSelect = (pattern: LokiQueryPattern, selectAsNewQuery = false) => {
    const queryString = selectAsNewQuery ? '' : query.expr;
    const visualQuery = buildVisualQueryFromString(queryString);
    visualQuery.query.operations = pattern.operations;

    if (hasNewQueryOption && selectAsNewQuery) {
      onAddQuery({
        ...query,
        refId: getNextRefIdChar(queries ?? [query]),
        expr: lokiQueryModeller.renderQuery(visualQuery.query),
      });
    } else {
      onChange({
        ...query,
        expr: lokiQueryModeller.renderQuery(visualQuery.query),
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
      {Object.values(LokiQueryPatternType).map((patternType) => {
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
              {lokiQueryModeller
                .getQueryPatterns()
                .filter((pattern) => pattern.type === patternType)
                .map((pattern) => (
                  <QueryPatternsCard
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
