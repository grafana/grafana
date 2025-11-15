// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/QueryPattern.tsx
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Card, useStyles2 } from '@grafana/ui';

import { promqlGrammar } from '../promql';

import { RawQuery } from './shared/RawQuery';
import { promQueryModeller } from './shared/modeller_instance';
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
    <Card noMargin className={styles.card}>
      <Card.Heading>{pattern.name}</Card.Heading>
      <div className={styles.rawQueryContainer}>
        <RawQuery
          aria-label={t(
            'grafana-prometheus.querybuilder.query-pattern.aria-label-raw-query',
            '{{patternName}} raw query',
            {
              patternName: pattern.name,
            }
          )}
          query={promQueryModeller.renderQuery({
            metric: '',
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
            aria-label={t(
              'grafana-prometheus.querybuilder.query-pattern.aria-label-use-this-query-button',
              'use this query button'
            )}
            onClick={() => {
              if (hasPreviousQuery) {
                // If user has previous query, we need to confirm that they want to apply this query pattern
                setSelectedPatternName(pattern.name);
              } else {
                onPatternSelect(pattern);
              }
            }}
          >
            <Trans i18nKey="grafana-prometheus.querybuilder.query-pattern.use-this-query">Use this query</Trans>
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
            <Button
              size="sm"
              aria-label={t('grafana-prometheus.querybuilder.query-pattern.aria-label-back-button', 'back button')}
              fill="outline"
              onClick={() => setSelectedPatternName(null)}
            >
              <Trans i18nKey="grafana-prometheus.querybuilder.query-pattern.back">Back</Trans>
            </Button>
            <Button
              size="sm"
              aria-label={t(
                'grafana-prometheus.querybuilder.query-pattern.aria-label-apply-query-starter-button',
                'apply query starter button'
              )}
              onClick={() => {
                onPatternSelect(pattern);
              }}
            >
              <Trans i18nKey="grafana-prometheus.querybuilder.query-pattern.apply-query">Apply query</Trans>
            </Button>
            {hasNewQueryOption && (
              <Button
                size="sm"
                aria-label={t(
                  'grafana-prometheus.querybuilder.query-pattern.aria-label-create-new-query-button',
                  'create new query button'
                )}
                onClick={() => {
                  onPatternSelect(pattern, true);
                }}
              >
                <Trans i18nKey="grafana-prometheus.querybuilder.query-pattern.create-new-query">Create new query</Trans>
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
    card: css({
      width: '49.5%',
      display: 'flex',
      flexDirection: 'column',
    }),
    rawQueryContainer: css({
      flexGrow: 1,
    }),
    rawQuery: css({
      backgroundColor: theme.colors.background.primary,
      padding: theme.spacing(1),
      marginTop: theme.spacing(1),
    }),
    spacing: css({
      marginBottom: theme.spacing(1),
    }),
  };
};
