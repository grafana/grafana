import { cx } from '@emotion/css';
import React, { useState } from 'react';

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
};

export function QuerySuggestionItem(props: Props) {
  const { querySuggestion, order, queryExplain, historical, onChange, closeDrawer } = props;
  const [showExp, updShowExp] = useState<boolean>(false);

  const theme = useTheme2();
  const styles = getStyles(theme);

  const { query, explanation } = querySuggestion;

  return (
    <>
      <div className={styles.header}>
        <div className={styles.codeText}>{`${order}  ${query}`}</div>
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
              <div className={cx(styles.rightButtons, styles.secondaryText)}>
                Was this explanation helpful?
                <div className={styles.floatRight}>
                  <Button fill="outline" variant="secondary" size="sm" className={styles.leftButton}>
                    Yes
                  </Button>
                  <Button fill="outline" variant="secondary" size="sm">
                    No
                  </Button>
                </div>
              </div>
            </div>

            {historical && order !== 5 && <hr />}
          </>
        )}
        {historical && order === 5 && (
          <div className={cx(styles.feedbackPadding)}>
            <Button fill="outline" variant="secondary" size="sm" className={styles.floatRight}>
              Give feedback on suggestions
            </Button>
          </div>
        )}
        {!historical && (
          <div className={cx(styles.feedbackPadding)}>
            <Button fill="outline" variant="secondary" size="sm" className={styles.floatRight}>
              Give feedback on suggestions
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
