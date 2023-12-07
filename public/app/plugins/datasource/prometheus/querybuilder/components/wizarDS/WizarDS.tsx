import { css } from '@emotion/css';
import React, { useEffect, useReducer, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
// import { reportInteraction } from '@grafana/runtime';
import { Button, Stack, Text, useTheme2 } from '@grafana/ui';
import store from 'app/core/store';

import { StartingMessage } from './StartingMessage';
import { WizardDSInteraction } from './WizardDSInteraction';
// @ts-ignore until we can get these added for icons
import AI_Logo_color from './resources/AI_Logo_color.svg';
import { wizarDSExplain, wizarDSSuggest } from './state/helpers';
import { initialState, stateSlice } from './state/state';
import { Interaction, Suggestion, SuggestionType } from './types';

// actions to update the state
const { showStartingMessage, indicateCheckbox, addInteraction, updateInteraction } = stateSlice.actions;

export type WizarDSProps = {
  closeDrawer: () => void;
  templates: Suggestion[];
};

const SKIP_STARTING_MESSAGE = 'SKIP_STARTING_MESSAGE';

export const WizarDS = (props: WizarDSProps) => {
  const { closeDrawer, templates } = props;
  const skipStartingMessage = store.getBool(SKIP_STARTING_MESSAGE, false);
  const [state, dispatch] = useReducer(stateSlice.reducer, initialState(templates, !skipStartingMessage));
  const suggestions = state.interactions.reduce((acc, int) => acc + int.suggestions.length, 0);
  const responsesEndRef = useRef(null);

  const scrollToBottom = () => {
    if (responsesEndRef) {
      // @ts-ignore for React.MutableRefObject
      responsesEndRef?.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // only scroll when an interaction has been added or the suggestions have been updated
    scrollToBottom();
  }, [state.interactions.length, suggestions]);

  const theme = useTheme2();
  const styles = getStyles(theme);

  const hideStartingMessage = () => {
    const val = store.getBool(SKIP_STARTING_MESSAGE, false);
    store.set(SKIP_STARTING_MESSAGE, !val);
    dispatch(indicateCheckbox(!val));
  };

  return (
    <div className={styles.containerPadding}>
      <Stack alignItems="center" justifyContent="space-between">
        <Stack alignItems="center" gap={1.5}>
          <img src={`public/img/ai-icons/AI_Logo_color.svg`} alt="AI logo color" />
          <Text element="h2">Query Wizard</Text>
        </Stack>
        <Button icon="times" fill="text" variant="secondary" onClick={closeDrawer} />
      </Stack>
      <div className={styles.subTitle}>Helping with your workflow</div>
      <div>
        {state.showStartingMessage ? (
          <StartingMessage
            onCancel={closeDrawer}
            onContinue={() => dispatch(showStartingMessage(false))}
            onDontShowChange={hideStartingMessage}
            dontShowState={state.indicateCheckbox}
          />
        ) : (
          <div className={styles.bodySmall}>
            {state.interactions.map((interaction: Interaction, idx: number) => {
              return (
                <WizardDSInteraction
                  key={idx}
                  interaction={interaction}
                  data-testid={testIds.submitPrompt + idx}
                  onCancel={closeDrawer}
                  onSubmit={(prompt) => {
                    const newInteraction = {
                      ...interaction,
                      prompt,
                      isLoading: true,
                    };

                    const payload = {
                      idx,
                      interaction: newInteraction,
                    };

                    dispatch(updateInteraction(payload));
                    wizarDSSuggest(dispatch, idx, templates, interaction);
                  }}
                  onNextInteraction={() => {
                    const isLoading = false;
                    const suggestionType = SuggestionType.AI;
                    dispatch(addInteraction({ suggestionType, isLoading }));
                  }}
                  onExplain={(suggIdx: number) =>
                    interaction.suggestions[suggIdx].explanation === ''
                      ? wizarDSExplain(dispatch, idx, interaction, suggIdx)
                      : interaction.suggestions[suggIdx].explanation
                  }
                  tutorial={state.tutorial}
                />
              );
            })}
          </div>
        )}
      </div>
      {!state.showStartingMessage && (
        <div className={styles.seeItAll}>
          <Button fill="text" variant="secondary" onClick={() => {}}>
            See examples
          </Button>
          <Button
            fill="text"
            variant="secondary"
            onClick={() => {
              // reportInteraction('grafana_prometheus_promqail_know_what_you_want_to_query', {
              //   promVisualQuery: query,
              //   doYouKnow: 'no',
              // });
              // JUST SUGGEST QUERIES AND SHOW THE LIST
              // use the most current interaction
              const currentInteractionIdx = state.interactions.length - 1;

              const newInteraction: Interaction = {
                ...state.interactions[currentInteractionIdx],
                suggestionType: SuggestionType.Historical,
                isLoading: true,
              };

              const payload = {
                idx: currentInteractionIdx,
                interaction: newInteraction,
              };
              dispatch(updateInteraction(payload));
              wizarDSSuggest(dispatch, currentInteractionIdx, templates, newInteraction);
            }}
          >
            Show me everything
          </Button>
        </div>
      )}
      <div ref={responsesEndRef} />
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    containerPadding: css({
      display: `flex`,
      flexDirection: `column`,
      padding: theme.spacing(3.5),
      background: theme.colors.background.primary,
      overflow: 'auto',
      height: '100%',
    }),
    subTitle: css({
      margin: theme.spacing(0.5, 0, 2),
      color: theme.colors.text.secondary,
    }),
    bodySmall: css({
      fontSize: `${theme.typography.bodySmall.fontSize}`,
    }),
    seeItAll: css({
      marginTop: 'auto',
    }),
  };
};

export const testIds = {
  wizarDS: 'wizar-ds',
  securityInfoButton: 'security-info-button',
  clickForHistorical: 'click-for-historical',
  clickForAi: 'click-for-ai',
  submitPrompt: 'submit-prompt',
  refinePrompt: 'refine-prompt',
};
