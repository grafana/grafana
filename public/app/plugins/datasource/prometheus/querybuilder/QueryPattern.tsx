import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Card, useStyles2 } from '@grafana/ui';
import { RawQuery } from 'app/plugins/datasource/prometheus/querybuilder/shared/RawQuery';

import promqlGrammar from '../promql';

import { promQueryModeller } from './PromQueryModeller';
import { PromQueryPattern } from './types';

type Props = {
  pattern: PromQueryPattern;
  hasNewQueryOption: boolean;
  hasPreviousQuery: boolean | string;
  selectedPatternName: string | null;
  setSelectedPatternName: (name: string | null) => void;
  onPatternSelect: (pattern: PromQueryPattern, selectAsNewQuery?: boolean) => void;
};

export const QueryPattern = (props: Props) => {
  const { pattern, onPatternSelect, hasNewQueryOption, hasPreviousQuery, selectedPatternName, setSelectedPatternName } =
    props;

  const styles = useStyles2(getStyles);
  const lang = { grammar: promqlGrammar, name: 'promql' };

  return (
    <Card className={styles.card}>
      <Card.Heading>{pattern.name}</Card.Heading>
      <div className={styles.rawQueryContainer}>
        <RawQuery
          aria-label={`${pattern.name} raw query`}
          query={promQueryModeller.renderQuery({
            labels: [],
            operations: pattern.operations,
            binaryQueries: pattern.binaryQueries,
          })}
          lang={lang}
          className={styles.rawQuery}
        />
      </div>
      <Card.Actions>
        {selectedPatternName !== pattern.name ? (
          <Button
            size="sm"
            aria-label="use this query button"
            onClick={() => {
              if (hasPreviousQuery) {
                // If user has previous query, we need to confirm that they want to apply this query pattern
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
                  ? 'you can either apply this query pattern or create a new query'
                  : 'this query pattern will be applied to your current query'
              }.`}
            </div>
            <Button size="sm" aria-label="back button" fill="outline" onClick={() => setSelectedPatternName(null)}>
              Back
            </Button>
            <Button
              size="sm"
              aria-label="apply query starter button"
              onClick={() => {
                onPatternSelect(pattern);
              }}
            >
              Apply query
            </Button>
            {hasNewQueryOption && (
              <Button
                size="sm"
                aria-label="create new query button"
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
