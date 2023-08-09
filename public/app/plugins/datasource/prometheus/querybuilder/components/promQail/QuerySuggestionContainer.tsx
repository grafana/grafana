import { cx } from '@emotion/css';
import React from 'react';

import { Button, useTheme2 } from '@grafana/ui';

import { getStyles } from './PromQail';
import { QuerySuggestionItem } from './QuerySuggestionItem';
import { QuerySuggestion, SuggestionType } from './types';

export type Props = {
  querySuggestions: QuerySuggestion[];
  suggestionType: SuggestionType;
};

export function QuerySuggestionContainer(props: Props) {
  const { suggestionType, querySuggestions } = props;

  const theme = useTheme2();
  const styles = getStyles(theme);

  let text, secondaryText;

  if (suggestionType === SuggestionType.Historical) {
    text = 'Here is the metric you have selected:';
    secondaryText = 'These queries based off of historical data (top used queries) for your metric.';
  } else if (suggestionType === SuggestionType.AI) {
    text = 'Here are 5 query suggestions:';
    secondaryText =
      'These queries were based off of natural language descriptions of the most commonly used PromQL queries.';
  }

  return (
    <>
      <div className={styles.textPadding}>{text}</div>
      <div className={cx(styles.secondaryText, styles.bottomMargin)}>{secondaryText}</div>
      <div className={styles.infoContainer}>
        {querySuggestions.map((qs: QuerySuggestion, idx: number) => {
          return <QuerySuggestionItem querySuggestion={qs} key={idx} order={idx + 1} />;
        })}
      </div>
    </>
  );
}
