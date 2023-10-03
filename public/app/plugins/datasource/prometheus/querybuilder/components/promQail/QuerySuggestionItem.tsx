import { cx } from '@emotion/css';
import React, { useState } from 'react';

import { reportInteraction } from '@grafana/runtime';
import { Button, Spinner, useTheme2 } from '@grafana/ui';

import { buildVisualQueryFromString } from '../../parsing';
import { PromVisualQuery } from '../../types';

import { getStyles } from './PromQail';
import { QuerySuggestion } from './types';

export type Props = {
  querySuggestion: QuerySuggestion;
  order: number;
  queryExplain: (idx: number) => void;
  historical: boolean;
  onChange: (query: PromVisualQuery) => void;
  closeDrawer: () => void;
  last: boolean;
};

export function QuerySuggestionItem(props: Props) {
  const { querySuggestion, order, queryExplain, historical, onChange, closeDrawer, last } = props;
  const [showExp, updShowExp] = useState<boolean>(false);

  const [gaveExplanationFeedback, updateGaveExplanationFeedback] = useState<boolean>(false);

  const theme = useTheme2();
  const styles = getStyles(theme);

  const { query, explanation } = querySuggestion;

  return (
    <>
      <div className={styles.querySuggestion}>
        <div title={query} className={cx(styles.codeText, styles.longCode)}>
          {`${order}  ${query}`}
        </div>
        <div className={styles.useButton}>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const pvq = buildVisualQueryFromString(querySuggestion.query);
              // check for errors!
              onChange(pvq.query);
              closeDrawer();
            }}
          >
            Use
          </Button>
        </div>
      </div>
      <div>
        <Button
          fill="text"
          variant="secondary"
          icon={showExp ? 'angle-up' : 'angle-down'}
          onClick={() => {
            updShowExp(!showExp);
            queryExplain(order - 1);
          }}
          className={cx(styles.bodySmall)}
          size="sm"
        >
          Explainer
        </Button>
        {historical && !showExp && order !== 5 && <div className={styles.textPadding}></div>}

        {showExp && !querySuggestion.explanation && (
          <div className={styles.center}>
            <Spinner />
          </div>
        )}
        {showExp && querySuggestion.explanation && (
          <>
            <div className={cx(styles.bodySmall, styles.explainPadding)}>
              <div className={styles.textPadding}>This query is trying to answer the question:</div>
              <div className={styles.textPadding}>{explanation}</div>
              <div className={styles.textPadding}>
                Learn more with this{' '}
                <a
                  className={styles.doc}
                  href={'https://prometheus.io/docs/prometheus/latest/querying/examples/#query-examples'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Prometheus doc
                </a>
              </div>
              {!gaveExplanationFeedback && (
                <div className={cx(styles.rightButtons, styles.secondaryText)}>
                  Was this explanation helpful?
                  <div className={styles.floatRight}>
                    <Button
                      fill="outline"
                      variant="secondary"
                      size="sm"
                      className={styles.leftButton}
                      onClick={() => {
                        explanationFeedback(querySuggestion, true, historical);
                        updateGaveExplanationFeedback(true);
                      }}
                    >
                      Yes
                    </Button>
                    <Button
                      fill="outline"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        explanationFeedback(querySuggestion, false, historical);
                        updateGaveExplanationFeedback(true);
                      }}
                    >
                      No
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {!last && <hr />}
          </>
        )}
        {last && (
          <div className={cx(styles.feedbackPadding)}>
            <a
              href="https://forms.gle/2EqJ4GqmgVcH2gkV7"
              className={styles.floatRight}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Button fill="outline" variant="secondary" size="sm">
                Give feedback on suggestions
              </Button>
            </a>
          </div>
        )}
      </div>
    </>
  );
}

function explanationFeedback(querySuggestion: QuerySuggestion, helpful: boolean, historical: boolean) {
  const event = 'grafana_prometheus_promqail_explanation_feedback';

  reportInteraction(event, {
    helpful: helpful ? 'yes' : 'no',
    suggestionType: historical ? 'historical' : 'AI',
    query: querySuggestion.query,
    explanation: querySuggestion.explanation,
  });
}
