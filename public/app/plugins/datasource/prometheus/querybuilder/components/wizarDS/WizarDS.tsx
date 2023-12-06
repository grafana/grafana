import { css, cx } from '@emotion/css';
import React, { useEffect, useReducer, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
// import { reportInteraction } from '@grafana/runtime';
import { Button, Checkbox, Input, Spinner, useTheme2 } from '@grafana/ui';
import store from 'app/core/store';

import { SuggestionContainer } from './SuggestionContainer';
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

  const [state, dispatch] = useReducer(stateSlice.reducer, initialState(!skipStartingMessage));

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

  return (
    <div className={styles.containerPadding}>
      {/* WizarDS */}
      {/* header */}
      <div className={styles.header}>
        <h3>Query wizard</h3>
        <Button icon="times" fill="text" variant="secondary" onClick={closeDrawer} />
      </div>
      {/* Starting message */}
      <div>
        <div className={styles.iconSection}>
          <img src={`public/img/ai-icons/AI_Logo_color.svg`} alt="AI logo color" /> Query wizard
        </div>
        {state.showStartingMessage ? (
          <>
            <div className={styles.textPadding}>
              The Query wizard can take you on a journey through the Prometheus UI using AI
            </div>
            <div className={styles.textPadding}>The Query wizard will connect to OpenAI using your API key.</div>
            <div className={styles.textPadding}>Check with OpenAI to understand how your data is being used.</div>
            <div>
              The Query wizard information comes from Grafana docs and is interpreted by ChatGPT when you enter a
              prompt. Please be aware of the limitations of using LLMs and double check the accuracy of the suggestions.
            </div>

            {/* don't show this message again, store in localstorage */}
            <div className={styles.textPadding}>
              <Checkbox
                checked={state.indicateCheckbox}
                value={state.indicateCheckbox}
                onChange={() => {
                  const val = store.getBool(SKIP_STARTING_MESSAGE, false);
                  store.set(SKIP_STARTING_MESSAGE, !val);
                  dispatch(indicateCheckbox(!val));
                }}
                label="Don't show this message again"
              />
            </div>
            <div className={styles.rightButtonsWrapper}>
              <div className={styles.rightButtons}>
                <Button className={styles.leftButton} fill="outline" variant="secondary" onClick={closeDrawer}>
                  Cancel
                </Button>
                <Button
                  fill="solid"
                  variant="primary"
                  onClick={() => dispatch(showStartingMessage(false))}
                  data-testid={testIds.securityInfoButton}
                >
                  Continue
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.bodySmall}>
            {state.interactions.map((interaction: Interaction, idx: number) => {
              return (
                <div key={idx}>
                  {interaction.suggestionType === SuggestionType.AI ? (
                    <>
                      <div className={styles.textPadding}>What would you like to learn about from the WizarDS?</div>
                      <div className={cx(styles.secondaryText, styles.bottomMargin)}>
                        {/* <div>You do not need to enter in a metric or a label again in the prompt.</div> */}
                        <div>Example: I want to know how the rate interval is calculated.</div>
                      </div>
                      <div className={styles.inputPadding}>
                        <Input
                          value={interaction.prompt}
                          spellCheck={false}
                          placeholder="Enter prompt"
                          disabled={interaction.suggestions.length > 0}
                          onChange={(e) => {
                            const prompt = e.currentTarget.value;

                            const payload = {
                              idx: idx,
                              interaction: { ...interaction, prompt },
                            };

                            dispatch(updateInteraction(payload));
                          }}
                        />
                      </div>
                      {interaction.suggestions.length === 0 ? (
                        interaction.isLoading ? (
                          <>
                            <div className={styles.loadingMessageContainer}>
                              Waiting for OpenAI <Spinner className={styles.floatRight} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={styles.rightButtonsWrapper}>
                              <div className={styles.rightButtons}>
                                <Button
                                  className={styles.leftButton}
                                  fill="outline"
                                  variant="secondary"
                                  onClick={closeDrawer}
                                >
                                  Cancel
                                </Button>
                                {/* <Button
                                  className={styles.leftButton}
                                  fill="outline"
                                  variant="secondary"
                                  onClick={() => {
                                    // JUST SUGGEST QUERIES AND SHOW THE LIST
                                    const newInteraction: Interaction = {
                                      ...interaction,
                                      suggestionType: SuggestionType.Historical,
                                      isLoading: true,
                                    };

                                    const payload = {
                                      idx: idx,
                                      interaction: newInteraction,
                                    };

                                    // reportInteraction('grafana_prometheus_promqail_suggest_query_instead', {
                                    //   promVisualQuery: query,
                                    // });

                                    dispatch(updateInteraction(payload));
                                    wizarDSSuggest(dispatch, idx, templates, newInteraction);
                                  }}
                                >
                                  Show me everything instead.
                                </Button> */}
                                <Button
                                  fill="solid"
                                  variant="primary"
                                  data-testid={testIds.submitPrompt + idx}
                                  onClick={() => {
                                    const newInteraction: Interaction = {
                                      ...interaction,
                                      isLoading: true,
                                    };

                                    const payload = {
                                      idx: idx,
                                      interaction: newInteraction,
                                    };

                                    // reportInteraction('grafana_prometheus_promqail_prompt_submitted', {
                                    //   promVisualQuery: query,
                                    //   prompt: interaction.prompt,
                                    // });

                                    dispatch(updateInteraction(payload));
                                    // add the suggestions in the API call
                                    wizarDSSuggest(dispatch, idx, templates, interaction);
                                  }}
                                >
                                  Submit
                                </Button>
                              </div>
                            </div>
                          </>
                        )
                      ) : (
                        // LIST OF SUGGESTED QUERIES FROM AI
                        <SuggestionContainer
                          suggestionType={SuggestionType.AI}
                          suggestions={interaction.suggestions}
                          closeDrawer={closeDrawer}
                          nextInteraction={() => {
                            const isLoading = false;
                            const suggestionType = SuggestionType.AI;
                            dispatch(addInteraction({ suggestionType, isLoading }));
                          }}
                          explain={(suggIdx: number) =>
                            interaction.suggestions[suggIdx].explanation === ''
                              ? wizarDSExplain(dispatch, idx, interaction, suggIdx)
                              : interaction.suggestions[suggIdx].explanation
                          }
                          // onChange={onChange}
                          prompt={interaction.prompt ?? ''}
                        />
                      )}
                    </>
                  ) : // HISTORICAL SUGGESTIONS
                  interaction.isLoading ? (
                    <>
                      <div className={styles.loadingMessageContainer}>
                        Waiting for OpenAI <Spinner className={styles.floatRight} />
                      </div>
                    </>
                  ) : (
                    // LIST OF SUGGESTED QUERIES FROM HISTORICAL DATA
                    <SuggestionContainer
                      suggestionType={SuggestionType.Historical}
                      suggestions={interaction.suggestions}
                      closeDrawer={closeDrawer}
                      nextInteraction={() => {
                        const isLoading = false;
                        const suggestionType = SuggestionType.AI;
                        dispatch(addInteraction({ suggestionType, isLoading }));
                      }}
                      explain={(suggIdx: number) =>
                        interaction.suggestions[suggIdx].explanation === ''
                          ? wizarDSExplain(dispatch, idx, interaction, suggIdx)
                          : interaction.suggestions[suggIdx].explanation
                      }
                      // onChange={onChange}
                      prompt={interaction.prompt ?? ''}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Button
        fill="text"
        variant="secondary"
        onClick={() => {
          // reportInteraction('grafana_prometheus_promqail_know_what_you_want_to_query', {
          //   promVisualQuery: query,
          //   doYouKnow: 'no',
          // });
          // JUST SUGGEST QUERIES AND SHOW THE LIST
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

          // reportInteraction('grafana_prometheus_promqail_suggest_query_instead', {
          //   promVisualQuery: query,
          // });

          dispatch(updateInteraction(payload));
          wizarDSSuggest(dispatch, currentInteractionIdx, templates, newInteraction);
        }}
      >
        Just walk me through everything
      </Button>
      <div ref={responsesEndRef} />
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    sectionPadding: css({
      padding: '20px',
    }),
    header: css({
      display: 'flex',

      button: {
        marginLeft: 'auto',
      },
    }),
    iconSection: css({
      padding: '0 0 10px 0',
      color: `${theme.colors.text.secondary}`,

      img: {
        paddingRight: '4px',
      },
    }),
    rightButtonsWrapper: css({
      display: 'flex',
    }),
    rightButtons: css({
      marginLeft: 'auto',
    }),
    leftButton: css({
      marginRight: '10px',
    }),
    dataList: css({
      padding: '0px 28px 28px 28px',
    }),
    textPadding: css({
      paddingBottom: '12px',
    }),
    containerPadding: css({
      padding: '28px',
    }),
    infoContainer: css({
      border: `${theme.colors.border.strong}`,
      padding: '16px',
      backgroundColor: `${theme.colors.background.secondary}`,
      borderRadius: `8px`,
      borderBottomLeftRadius: 0,
    }),
    infoContainerWrapper: css({
      paddingBottom: '24px',
    }),
    metricTable: css({
      width: '100%',
    }),
    metricTableName: css({
      width: '15%',
    }),
    metricTableValue: css({
      fontFamily: `${theme.typography.fontFamilyMonospace}`,
      fontSize: `${theme.typography.bodySmall.fontSize}`,
      overflow: 'scroll',
      textWrap: 'nowrap',
      maxWidth: '150px',
      width: '60%',
      maskImage: `linear-gradient(to right, rgba(0, 0, 0, 1) 90%, rgba(0, 0, 0, 0))`,
    }),
    metricTableButton: css({
      float: 'right',
    }),
    queryQuestion: css({
      textAlign: 'end',
      padding: '8px 0',
    }),
    secondaryText: css({
      color: `${theme.colors.text.secondary}`,
    }),
    loadingMessageContainer: css({
      border: `${theme.colors.border.strong}`,
      padding: `16px`,
      backgroundColor: `${theme.colors.background.secondary}`,
      marginBottom: `20px`,
      borderRadius: `8px`,
      color: `${theme.colors.text.secondary}`,
      fontStyle: 'italic',
    }),
    floatRight: css({
      float: 'right',
    }),
    codeText: css({
      fontFamily: `${theme.typography.fontFamilyMonospace}`,
      fontSize: `${theme.typography.bodySmall.fontSize}`,
    }),
    bodySmall: css({
      fontSize: `${theme.typography.bodySmall.fontSize}`,
    }),
    explainPadding: css({
      paddingLeft: '26px',
    }),
    bottomMargin: css({
      marginBottom: '20px',
    }),
    topPadding: css({
      paddingTop: '22px',
    }),
    doc: css({
      textDecoration: 'underline',
    }),
    afterButtons: css({
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    feedbackStyle: css({
      margin: 0,
      textAlign: 'right',
      paddingTop: '22px',
      paddingBottom: '22px',
    }),
    nextInteractionHeight: css({
      height: '88px',
    }),
    center: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    inputPadding: css({
      paddingBottom: '24px',
    }),
    suggestion: css({
      display: 'flex',
      flexWrap: 'nowrap',
    }),
    longCode: css({
      width: '90%',
      textWrap: 'nowrap',
      overflow: 'scroll',
      maskImage: `linear-gradient(to right, rgba(0, 0, 0, 1) 90%, rgba(0, 0, 0, 0))`,

      div: {
        display: 'inline-block',
      },
    }),
    useButton: css({
      marginLeft: 'auto',
    }),
    suggestionFeedback: css({
      textAlign: 'left',
    }),
    feedbackQuestion: css({
      display: 'flex',
      padding: '8px 0px',
      h6: { marginBottom: 0 },
      i: {
        marginTop: '1px',
      },
    }),
    explationTextInput: css({
      paddingLeft: '24px',
    }),
    submitFeedback: css({
      padding: '16px 0',
    }),
    suggestEverything: css({
      position: 'absolute',
      left: 0,
      bottom: '20px',
      right: 0,
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
