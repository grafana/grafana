import { cx } from '@emotion/css';
import React, { useState } from 'react';

import { Button, useTheme2 } from '@grafana/ui';

import { SuggestionItem } from './SuggestionItem';
import { getStyles, testIds } from './WizarDS';
import { Suggestion, SuggestionType } from './types';

export type Props = {
  suggestions: Suggestion[];
  suggestionType: SuggestionType;
  closeDrawer: () => void;
  nextInteraction: () => void;
  explain: (idx: number) => void;
  prompt: string;
};

export function SuggestionContainer(props: Props) {
  const { suggestionType, suggestions, closeDrawer, nextInteraction, explain, prompt } = props;

  const [hasNextInteraction, updateHasNextInteraction] = useState<boolean>(false);

  const theme = useTheme2();
  const styles = getStyles(theme);

  let text, secondaryText, refineText;

  if (suggestionType === SuggestionType.Historical) {
    text = `Here is a list of the components from the Prometheus UI:`;
    secondaryText = '';
    refineText = 'I want ask a question';
  } else if (suggestionType === SuggestionType.AI) {
    text = text = 'Here are is your answer from the LLM:';
    secondaryText = 'This information is from Grafana docs and your LLM of choice';
    refineText = 'Refine prompt';
  }

  return (
    <>
      <div className={styles.textPadding}>{text}</div>
      <div className={cx(styles.secondaryText, styles.bottomMargin)}>{secondaryText}</div>
      <div className={styles.infoContainerWrapper}>
        <div className={styles.infoContainer}>
          {
            /*suggestionType === SuggestionType.Historical &&*/
            suggestions.map((qs: Suggestion, idx: number) => {
              return (
                <SuggestionItem
                  historical={suggestionType === SuggestionType.Historical}
                  suggestion={qs}
                  key={idx}
                  order={idx + 1}
                  explain={explain}
                  // onChange={onChange}
                  closeDrawer={closeDrawer}
                  last={idx === 8}
                  // for feedback rudderstack events
                  allSuggestions={suggestions.reduce((acc: string, qs: Suggestion) => {
                    return acc + '$$' + qs.component;
                  }, '')}
                  prompt={prompt ?? ''}
                />
              );
            })
          }
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
