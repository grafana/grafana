import { cx } from '@emotion/css';
import React, { useState } from 'react';

import { Button, useTheme2 } from '@grafana/ui';

import { getStyles } from './PromQail';
import { QuerySuggestion } from './types';

export type Props = {
  querySuggestion: QuerySuggestion;
  order: number;
};

export function QuerySuggestionItem(props: Props) {
  const { querySuggestion, order } = props;
  const [showExp, updShowExp] = useState<boolean>(false);

  const theme = useTheme2();
  const styles = getStyles(theme);

  const { query, explanation } = querySuggestion;

  return (
    <>
      <div className={styles.header}>
        <div className={styles.codeText}>{`${order}  ${query}`}</div>
        <Button variant="primary" size="sm">
          Use
        </Button>
      </div>
      <div>
        <Button
          fill="text"
          variant="secondary"
          icon={showExp ? 'angle-up' : 'angle-down'}
          onClick={() => updShowExp(!showExp)}
          className={styles.bodySmall}
          size="sm"
        >
          Explainer
        </Button>
        {showExp && (
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
            {order !== 5 && <hr />}
          </>
        )}
        {order === 5 && (
          <div className={cx(styles.textPadding, showExp && styles.topPadding)}>
            <Button fill="outline" variant="secondary" size="sm" className={styles.floatRight}>
              Give feedback on suggestions
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
