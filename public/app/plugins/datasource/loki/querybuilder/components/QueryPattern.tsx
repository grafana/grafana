import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, useStyles2 } from '@grafana/ui';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';

import logqlGrammar from '../../syntax';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { LokiQueryPattern } from '../types';

type Props = {
  pattern: LokiQueryPattern;
  hasNewQueryOption: boolean;
  hasPreviousQuery: boolean;
  selectedPatternName: string | null;
  setSelectedPatternName: (name: string | null) => void;
  onPatternSelect: (pattern: LokiQueryPattern, selectAsNewQuery?: boolean) => void;
};

export const QueryPattern = (props: Props) => {
  const { pattern, onPatternSelect, hasNewQueryOption, hasPreviousQuery, selectedPatternName, setSelectedPatternName } =
    props;

  const styles = useStyles2(getStyles);
  const lang = { grammar: logqlGrammar, name: 'logql' };

  return (
    <Card className={styles.card}>
      <Card.Heading>{pattern.name}</Card.Heading>
      <div className={styles.rawQueryContainer}>
        <RawQuery
          query={lokiQueryModeller.renderQuery({ labels: [], operations: pattern.operations })}
          lang={lang}
          className={styles.rawQuery}
        />
      </div>
      <Card.Actions>
        {selectedPatternName !== pattern.name ? (
          <Button
            size="sm"
            onClick={() => {
              if (hasPreviousQuery) {
                // If user has previous query, we need to confirm that they want to replace it
                setSelectedPatternName(pattern.name);
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
            <Button size="sm" fill="outline" onClick={() => setSelectedPatternName(null)}>
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
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
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
