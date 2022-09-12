import { css } from '@emotion/css';
import React, { useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, Collapse, Modal, useStyles2 } from '@grafana/ui';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';

import logqlGrammar from '../../syntax';
import { LokiQuery } from '../../types';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiOperationId, LokiQueryPatternType } from '../types';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  query: LokiQuery;
  onChange: (query: LokiQuery) => void;
  onAddQuery: (query: LokiQuery) => void;
};

export const QueryPatternsModal = (props: Props) => {
  const { isOpen, onClose, onChange, query, onAddQuery } = props;
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [selectedPatternIndex, setSelectedPatternIndex] = useState<number | null>(null);
  const indexOfSelectedCard = useRef(0);
  const lang = { grammar: logqlGrammar, name: 'logql' };

  const styles = useStyles2(getStyles);

  const {
    query: { operations },
  } = buildVisualQueryFromString(query.expr);

  const hasExistingQuery =
    operations.length > 1 ||
    (operations.length === 1 && operations[0].id === LokiOperationId.LineContains && operations[0].params[0] === '');

  return (
    <>
      <Modal isOpen={isOpen} title="Kick start your query" onDismiss={onClose}>
        <div className={styles.spacing}>
          Kick start your query by selecting one of these queries. You can then continue to complete your query.
        </div>
        {Object.values(LokiQueryPatternType).map((patternType) => {
          return (
            <Collapse
              key={patternType}
              label={`${patternType[0].toUpperCase() + patternType.slice(1)} query starters`}
              isOpen={openTabs.includes(patternType)}
              collapsible={true}
              onToggle={() =>
                setOpenTabs((tabs) =>
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
                        />
                      </div>
                      <Card.Actions>
                        {(!selectedPatternIndex || selectedPatternIndex !== index) && (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (hasExistingQuery) {
                                indexOfSelectedCard.current = index;
                                setSelectedPatternIndex(index);
                              } else {
                                const result = buildVisualQueryFromString(query.expr || '');
                                result.query.operations = pattern.operations;
                                onChange({
                                  ...query,
                                  expr: lokiQueryModeller.renderQuery(result.query),
                                });
                                onClose();
                              }
                            }}
                          >
                            Use this query
                          </Button>
                        )}
                        {selectedPatternIndex === index && (
                          <>
                            <div className={styles.spacing}>
                              If you would like to use this query, you can either replace your current query or create a
                              new query.
                            </div>
                            <Button size="sm" fill="outline" onClick={() => setSelectedPatternIndex(null)}>
                              Back
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                const result = buildVisualQueryFromString(query.expr || '');
                                result.query.operations = pattern.operations;
                                onChange({
                                  ...query,
                                  expr: lokiQueryModeller.renderQuery(result.query),
                                });
                                setSelectedPatternIndex(null);
                                onClose();
                              }}
                            >
                              Replace query
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                const result = buildVisualQueryFromString('');
                                result.query.operations = pattern.operations;
                                onAddQuery({
                                  ...query,
                                  refId: `query ${pattern.name}`,
                                  expr: lokiQueryModeller.renderQuery(result.query),
                                });
                                setSelectedPatternIndex(null);
                                onClose();
                              }}
                            >
                              Create new query
                            </Button>
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
    </>
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
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1)};
      margin-top: ${theme.spacing(1)};
    `,
    spacing: css`
      margin-bottom: ${theme.spacing(1)};
    `,
  };
};
