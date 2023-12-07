import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Stack, useTheme2 } from '@grafana/ui';
import { RemoteTutorial } from 'app/features/tutorial/remotetutorial/RemoteTutorial';

import { SuggestionItem } from './SuggestionItem';
import { testIds } from './WizarDS';
import { Tutorial } from './state/state';
import { Suggestion, SuggestionType } from './types';

const LLM_OF_CHOICE = `OpenAI ChatGPT`;

export type Props = {
  suggestions: Suggestion[];
  suggestionType: SuggestionType;
  closeDrawer: () => void;
  nextInteraction: () => void;
  explain: (idx: number) => void;
  prompt: string;
  tutorial: Tutorial;
};

export function SuggestionContainer({
  suggestionType,
  suggestions,
  closeDrawer,
  nextInteraction,
  explain,
  prompt,
  tutorial,
}: Props) {
  const [hasNextInteraction, updateHasNextInteraction] = useState<boolean>(false);
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <>
      <div className={styles.container}>
        <Stack gap={3} direction={'column'}>
          <div className={styles.infoContainer}>
            {suggestions.map((qs: Suggestion, idx: number) => {
              return (
                <SuggestionItem
                  historical={suggestionType === SuggestionType.Historical}
                  suggestion={qs}
                  key={idx}
                  order={idx + 1}
                  explain={explain}
                  closeDrawer={closeDrawer}
                  last={idx === 8}
                  allSuggestions={suggestions.reduce((acc: string, qs: Suggestion) => {
                    return acc + '$$' + qs.component;
                  }, '')}
                  prompt={prompt ?? ''}
                  chosenLLM={LLM_OF_CHOICE}
                />
              );
            })}
          </div>
          <Stack alignItems={`center`} justifyContent={`space-between`}>
            <div className={styles.secondaryText}>{`This information is from Grafana docs and ${LLM_OF_CHOICE}.`}</div>
            <RemoteTutorial tutorial={tutorial} />
          </Stack>
        </Stack>
      </div>
      {!hasNextInteraction && (
        <div className={styles.nextInteractionHeight}>
          <Stack justifyContent="space-between">
            <div />
            <Stack>
              <Button fill="outline" variant="secondary" size="md" onClick={closeDrawer}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  updateHasNextInteraction(true);
                  nextInteraction();
                }}
                data-testid={testIds.refinePrompt}
                fill="outline"
                variant="primary"
                size="md"
              >
                Refine prompt
              </Button>
            </Stack>
          </Stack>
        </div>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: theme.spacing(4),
  }),
  secondaryText: css({
    color: `${theme.colors.text.secondary}`,
  }),
  infoContainer: css({
    border: `${theme.colors.border.strong}`,
    padding: '16px',
    backgroundColor: `${theme.colors.background.secondary}`,
    borderRadius: `8px`,
    borderBottomLeftRadius: 0,
  }),
  nextInteractionHeight: css({
    height: '88px',
  }),
});
