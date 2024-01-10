import { css, cx } from '@emotion/css';
import React, { useEffect, useReducer, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button, Checkbox, Input, Spinner, useTheme2 } from '@grafana/ui';
import store from 'app/core/store';

import { PrometheusDatasource } from '../../../datasource';
import { PromVisualQuery } from '../../types';

import { QuerySuggestionContainer } from './QuerySuggestionContainer';
// @ts-ignore until we can get these added for icons
import AI_Logo_color from './resources/AI_Logo_color.svg';
import { promQailExplain, promQailSuggest } from './state/helpers';
import { initialState, stateSlice } from './state/state';
import { Interaction, SuggestionType } from './types';

// actions to update the state
const { showStartingMessage, indicateCheckbox, addInteraction, updateInteraction } = stateSlice.actions;

export type PromQailProps = {
  query: PromVisualQuery;
  closeDrawer: () => void;
  onChange: (query: PromVisualQuery) => void;
  datasource: PrometheusDatasource;
};

const SKIP_STARTING_MESSAGE = 'SKIP_STARTING_MESSAGE';

export const PromQail = (props: PromQailProps) => {
  const { query, closeDrawer, onChange, datasource } = props;
  const skipStartingMessage = store.getBool(SKIP_STARTING_MESSAGE, false);

  const [state, dispatch] = useReducer(stateSlice.reducer, initialState(query, !skipStartingMessage));

  const [labelNames, setLabelNames] = useState<string[]>([]);

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

  useEffect(() => {
    const fetchLabels = async () => {
      let labelsIndex: Record<string, string[]>;
      if (datasource.hasLabelsMatchAPISupport()) {
        labelsIndex = await datasource.languageProvider.fetchSeriesLabelsMatch(query.metric);
      } else {
        labelsIndex = await datasource.languageProvider.fetchSeriesLabels(query.metric);
      }
      setLabelNames(Object.keys(labelsIndex));
    };
    fetchLabels();
  }, [query, datasource]);

  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.containerPadding}>
      {/* Query Advisor */}
      {/* header */}
      <div className={styles.header}>
        <h3>Query advisor</h3>
        <Button icon="times" fill="text" variant="secondary" onClick={closeDrawer} />
      </div>
      {/* Starting message */}
      <div>
        <div className={styles.iconSection}>
          <img src={AI_Logo_color} alt="AI logo color" /> Assistant
        </div>
        {state.showStartingMessage ? (
          <>
            <div className={styles.dataList}>
              <ol>
                <li className={styles.textPadding}>
                  Query Advisor suggests queries based on a metric and requests you type in.
                </li>
                <li className={styles.textPadding}>
                  Query Advisor sends Prometheus metrics, labels and metadata to the LLM provider you&#39;ve configured.
                  Be sure to align its usage with your company&#39;s internal policies.
                </li>
                <li className={styles.textPadding}>
                  An AI-suggested query may not fully answer your question. Always take a moment to understand a query
                  before you use it.
                </li>
              </ol>
            </div>
            <Alert
              title={''}
              severity={'info'}
              key={'promqail-llm-app'}
              className={cx(styles.textPadding, styles.noMargin)}
            >
              Query Advisor is currently in Private Preview. Feedback is appreciated and can be provided on explanations
              and suggestions.
            </Alert>

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
            {/* MAKE THIS TABLE RESPONSIVE */}
            {/* FIT SUPER LONG METRICS AND LABELS IN HERE */}
            <div className={styles.textPadding}>Here is the metric you have selected:</div>
            <div className={styles.infoContainerWrapper}>
              <div className={styles.infoContainer}>
                <table className={styles.metricTable}>
                  <tbody>
                    <tr>
                      <td className={styles.metricTableName}>metric</td>
                      <td className={styles.metricTableValue}>{state.query.metric}</td>
                      <td>
                        <Button
                          fill="outline"
                          variant="secondary"
                          onClick={closeDrawer}
                          className={styles.metricTableButton}
                          size={'sm'}
                        >
                          Choose new metric
                        </Button>
                      </td>
                    </tr>
                    {state.query.labels.map((label, idx) => {
                      const text = idx === 0 ? 'labels' : '';
                      return (
                        <tr key={`${label.label}-${idx}`}>
                          <td>{text}</td>
                          <td className={styles.metricTableValue}>{`${label.label}${label.op}${label.value}`}</td>
                          <td> </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ask if you know what you want to query? */}
            {!state.askForQueryHelp && state.interactions.length === 0 && (
              <>
                <div className={styles.queryQuestion}>Do you know what you want to query?</div>
                <div className={styles.rightButtonsWrapper}>
                  <div className={styles.rightButtons}>
                    <Button
                      className={styles.leftButton}
                      fill="solid"
                      variant="secondary"
                      data-testid={testIds.clickForHistorical}
                      onClick={() => {
                        const isLoading = true;
                        const suggestionType = SuggestionType.Historical;
                        dispatch(addInteraction({ suggestionType, isLoading }));
                        reportInteraction('grafana_prometheus_promqail_know_what_you_want_to_query', {
                          promVisualQuery: query,
                          doYouKnow: 'no',
                        });
                        promQailSuggest(dispatch, 0, query, labelNames, datasource);
                      }}
                    >
                      No
                    </Button>
                    <Button
                      fill="solid"
                      variant="primary"
                      data-testid={testIds.clickForAi}
                      onClick={() => {
                        reportInteraction('grafana_prometheus_promqail_know_what_you_want_to_query', {
                          promVisualQuery: query,
                          doYouKnow: 'yes',
                        });
                        const isLoading = false;
                        const suggestionType = SuggestionType.AI;
                        dispatch(addInteraction({ suggestionType, isLoading }));
                      }}
                    >
                      Yes
                    </Button>
                  </div>
                </div>
              </>
            )}

            {state.interactions.map((interaction: Interaction, idx: number) => {
              return (
                <div key={idx}>
                  {interaction.suggestionType === SuggestionType.AI ? (
                    <>
                      <div className={styles.textPadding}>What kind of data do you want to see with your metric?</div>
                      <div className={cx(styles.secondaryText, styles.bottomMargin)}>
                        <div>You do not need to enter in a metric or a label again in the prompt.</div>
                        <div>Example: I want to monitor request latency, not errors.</div>
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
                                <Button
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

                                    reportInteraction('grafana_prometheus_promqail_suggest_query_instead', {
                                      promVisualQuery: query,
                                    });

                                    dispatch(updateInteraction(payload));
                                    promQailSuggest(dispatch, idx, query, labelNames, datasource, newInteraction);
                                  }}
                                >
                                  Suggest queries instead
                                </Button>
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

                                    reportInteraction('grafana_prometheus_promqail_prompt_submitted', {
                                      promVisualQuery: query,
                                      prompt: interaction.prompt,
                                    });

                                    dispatch(updateInteraction(payload));
                                    // add the suggestions in the API call
                                    promQailSuggest(dispatch, idx, query, labelNames, datasource, interaction);
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
                        <QuerySuggestionContainer
                          suggestionType={SuggestionType.AI}
                          querySuggestions={interaction.suggestions}
                          closeDrawer={closeDrawer}
                          nextInteraction={() => {
                            const isLoading = false;
                            const suggestionType = SuggestionType.AI;
                            dispatch(addInteraction({ suggestionType, isLoading }));
                          }}
                          queryExplain={(suggIdx: number) =>
                            interaction.suggestions[suggIdx].explanation === ''
                              ? promQailExplain(dispatch, idx, query, interaction, suggIdx, datasource)
                              : interaction.suggestions[suggIdx].explanation
                          }
                          onChange={onChange}
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
                    <QuerySuggestionContainer
                      suggestionType={SuggestionType.Historical}
                      querySuggestions={interaction.suggestions}
                      closeDrawer={closeDrawer}
                      nextInteraction={() => {
                        const isLoading = false;
                        const suggestionType = SuggestionType.AI;
                        dispatch(addInteraction({ suggestionType, isLoading }));
                      }}
                      queryExplain={(suggIdx: number) =>
                        interaction.suggestions[suggIdx].explanation === ''
                          ? promQailExplain(dispatch, idx, query, interaction, suggIdx, datasource)
                          : interaction.suggestions[suggIdx].explanation
                      }
                      onChange={onChange}
                      prompt={interaction.prompt ?? ''}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
      padding: '0px 28px 0px 28px',
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
    querySuggestion: css({
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
    noMargin: css({
      margin: 0,
    }),
    enableButtonTooltip: css({
      padding: 8,
    }),
    enableButtonTooltipText: css({
      color: `${theme.colors.text.secondary}`,
      ul: {
        marginLeft: 16,
      },
    }),
    link: css({
      color: `${theme.colors.text.link} !important`,
    }),
  };
};

export const testIds = {
  promQail: 'prom-qail',
  securityInfoButton: 'security-info-button',
  clickForHistorical: 'click-for-historical',
  clickForAi: 'click-for-ai',
  submitPrompt: 'submit-prompt',
  refinePrompt: 'refine-prompt',
};
