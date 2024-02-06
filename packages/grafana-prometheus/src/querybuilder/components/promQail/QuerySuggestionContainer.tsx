import { cx } from '@emotion/css';
import React, { useState } from 'react';

import { Button, useTheme2 } from '@grafana/ui';

import { PromVisualQuery } from '../../types';

import { getStyles, testIds } from './PromQail';
import { QuerySuggestionItem } from './QuerySuggestionItem';
import { QuerySuggestion, SuggestionType } from './types';

export type Props = {
  querySuggestions: QuerySuggestion[];
  suggestionType: SuggestionType;
  closeDrawer: () => void;
  nextInteraction: () => void;
  queryExplain: (idx: number) => void;
  onChange: (query: PromVisualQuery) => void;
  prompt: string;
};

export function QuerySuggestionContainer(props: Props) {
  const { suggestionType, querySuggestions, closeDrawer, nextInteraction, queryExplain, onChange, prompt } = props;

  const [hasNextInteraction, updateHasNextInteraction] = useState<boolean>(false);

  const theme = useTheme2();
  const styles = getStyles(theme);

  let text, secondaryText, refineText;

  if (suggestionType === SuggestionType.Historical) {
    text = `Here are ${querySuggestions.length} query suggestions:`;
    refineText = 'I want to write a prompt';
  } else if (suggestionType === SuggestionType.AI) {
    text = text = 'Here is your query suggestion:';
    secondaryText =
      'This query is based off of natural language descriptions of the most commonly used PromQL queries.';
    refineText = 'Refine prompt';
  }

  return (
    <>
      {suggestionType === SuggestionType.Historical ? (
        <div className={styles.bottomMargin}>{text}</div>
      ) : (
        <>
          <div className={styles.textPadding}>{text}</div>
          <div className={cx(styles.secondaryText, styles.bottomMargin)}>{secondaryText}</div>
        </>
      )}

      <div className={styles.infoContainerWrapper}>
        <div className={styles.infoContainer}>
          {querySuggestions.map((qs: QuerySuggestion, idx: number) => {
            return (
              <QuerySuggestionItem
                historical={suggestionType === SuggestionType.Historical}
                querySuggestion={qs}
                key={idx}
                order={idx + 1}
                queryExplain={queryExplain}
                onChange={onChange}
                closeDrawer={closeDrawer}
                last={idx === querySuggestions.length - 1}
                // for feedback rudderstack events
                allSuggestions={querySuggestions.reduce((acc: string, qs: QuerySuggestion) => {
                  return acc + '$$' + qs.query;
                }, '')}
                prompt={prompt ?? ''}
              />
            );
          })}
        </div>
      </div>
      {!hasNextInteraction && (
        <div className={styles.nextInteractionHeight}>
          <div className={cx(styles.afterButtons, styles.textPadding)}>
            <Button
              onClick={() => {
                updateHasNextInteraction(true);
                nextInteraction();
              }}
              data-testid={testIds.refinePrompt}
              fill="outline"
              variant="secondary"
              size="md"
            >
              {refineText}
            </Button>
          </div>
          <div className={cx(styles.textPadding, styles.floatRight)}>
            <Button fill="outline" variant="secondary" size="md" onClick={closeDrawer}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
