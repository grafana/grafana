import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React, { useRef, useState } from 'react';

import { DataQuery, GrafanaTheme2 } from '@grafana/data';
import { Button, Card, Collapse, Modal, useStyles2 } from '@grafana/ui';
import { getNextRefIdChar } from 'app/core/utils/query';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';

import logqlGrammar from '../../syntax';
import { LokiQuery } from '../../types';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiQueryPattern, LokiQueryPatternType } from '../types';

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
  const [selectedPatternConfirmationIndex, setSelectedPatternConfirmationIndex] = useState<number | null>(null);
  const indexOfSelectedCard = useRef<number | null>(null);

  const styles = useStyles2(getStyles);
  const lang = { grammar: logqlGrammar, name: 'logql' };
  const hasPreviousQuery = buildVisualQueryFromString(query.expr).query.operations.length > 0;
  const hasNewQueryOption = !!onAddQuery;

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
    setSelectedPatternConfirmationIndex(null);
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
                .map((pattern, index) => (
                  <Card key={pattern.name} className={styles.card}>
                    <Card.Heading>{pattern.name}</Card.Heading>
                    <div className={styles.rawQueryContainer}>
                      <RawQuery
                        query={lokiQueryModeller.renderQuery({ labels: [], operations: pattern.operations })}
                        lang={lang}
                        className={styles.rawQuery}
                      />
                    </div>
                    <Card.Actions>
                      {selectedPatternConfirmationIndex !== index ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            if (hasPreviousQuery) {
                              // If user has previous query, we need to confirm that they want to replace it
                              indexOfSelectedCard.current = index;
                              setSelectedPatternConfirmationIndex(index);
                            } else {
                              onPatternSelect(pattern);
                            }
                          }}
                        >
                          Use this query
                        </Button>
                      ) : (
                        <>
                          <div className={styles.spacing}>
                            {`If you would like to use this query, ${
                              hasNewQueryOption
                                ? 'you can either replace your current query or create a new query'
                                : 'your current query will be replaced'
                            }.`}
                          </div>
                          <Button size="sm" fill="outline" onClick={() => setSelectedPatternConfirmationIndex(null)}>
                            Back
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              onPatternSelect(pattern);
                            }}
                          >
                            Replace query
                          </Button>
                          {hasNewQueryOption && (
                            <Button
                              size="sm"
                              onClick={() => {
                                onPatternSelect(pattern, true);
                              }}
                            >
                              Create new query
                            </Button>
                          )}
                        </>
                      )}
                    </Card.Actions>
                  </Card>
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
    card: css`
      width: 49.5%;
      display: flex;
      flex-direction: column;
    `,
    rawQueryContainer: css`
      flex-grow: 1;
    `,
    rawQuery: css`
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1)};
      margin-top: ${theme.spacing(1)};
    `,
    spacing: css`
      margin-bottom: ${theme.spacing(1)};
    `,
  };
};
