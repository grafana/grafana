import { css, cx } from '@emotion/css';
import React, { useReducer } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Checkbox, Drawer, Input, Spinner, useTheme2 } from '@grafana/ui';
import store from 'app/core/store';

import { PromVisualQuery } from '../../types';

import { QuerySuggestionContainer } from './QuerySuggestionContainer';
// @ts-ignore until we can get these added for icons
import AI_Logo_color from './resources/AI_Logo_color.svg';
import { callOpenAI, querySuggestions } from './state/helpers';
import { initialState, stateSlice } from './state/state';
import { SuggestionType } from './types';

// actions to update the state
const {
  showStartingMessage,
  showExplainer,
  indicateCheckbox,
  askForQueryHelp,
  knowWhatYouWantToQuery,
  promptKnowWhatToSeeWithMetric,
  aiIsLoading,
  giveMeHistoricalQueries,
} = stateSlice.actions;

export type PromQailProps = {
  query: PromVisualQuery;
  closeDrawer: () => void;
};

const SKIP_STARTING_MESSAGE = 'SKIP_STARTING_MESSAGE';

export const PromQail = (props: PromQailProps) => {
  const { query, closeDrawer } = props;
  const skipStartingMessage = store.getBool(SKIP_STARTING_MESSAGE, false);

  const [state, dispatch] = useReducer(stateSlice.reducer, initialState(query, !skipStartingMessage));

  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <div className={styles.containerPadding}>
      {/* Query Advisor */}
      {/* header */}
      <div className={styles.header}>
        <h3>Query advisor</h3>
        <Button fill="text" variant="secondary" onClick={closeDrawer}>
          x
        </Button>
      </div>
      {/* Starting message */}

      <div>
        <div className={styles.iconSection}>
          <img src={AI_Logo_color} alt="AI logo color" /> Assistant
        </div>
        {state.showStartingMessage ? (
          <>
            <div className={styles.textPadding}>
              This assistant can suggest queries based on your use case and the metric you want to query
            </div>
            <div className={styles.textPadding}>
              The assistant will connect to OpenAI using your API key. The following information will be sent to OpenAI:
            </div>
            <div className={styles.dataList}>
              <ul>
                <li>Metrics</li>
                <li>Labels</li>
                <li>Metrics metadata</li>
              </ul>
            </div>
            <div className={styles.textPadding}>Check with OpenAI to understand how your data is being used.</div>
            <div>
              AI-suggested queries may not always be the right one for your use case. Always take a moment to understand
              the queries before using them.
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
                <Button fill="solid" variant="primary" onClick={() => dispatch(showStartingMessage(false))}>
                  Continue
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* MAKE THIS TABLE RESPONSIVE */}
            {/* FIT SUPER LONG METRICS AND LABELS IN HERE */}
            <div className={styles.textPadding}>Here is the metric you have selected:</div>
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

            {/* Ask if you know what you want to query? */}
            {!state.askForQueryHelp ? (
              <>
                <div className={styles.queryQuestion}>Do you know what you want to query?</div>
                <div className={styles.rightButtonsWrapper}>
                  <div className={styles.rightButtons}>
                    <Button
                      className={styles.leftButton}
                      fill="solid"
                      variant="secondary"
                      onClick={() => {
                        dispatch(askForQueryHelp(true));
                        dispatch(knowWhatYouWantToQuery(false));
                      }}
                    >
                      No
                    </Button>
                    <Button
                      fill="solid"
                      variant="primary"
                      onClick={() => {
                        dispatch(askForQueryHelp(true));
                        dispatch(knowWhatYouWantToQuery(true));
                      }}
                    >
                      Yes
                    </Button>
                  </div>
                </div>
              </>
            ) : state.knowWhatYouWantToQuery ? (
              <>
                <div className={styles.textPadding}>What kind of data do you want to see with your metric?</div>
                <div className={cx(styles.secondaryText, styles.bottomMargin)}>
                  <div>You do not need to enter in a metric or a label again in the prompt.</div>
                  <div>Example: I want to monitor request latency, not errors.</div>
                </div>
                <div className={styles.textPadding}>
                  <Input
                    value={state.promptKnowWhatToSeeWithMetric}
                    spellCheck={false}
                    placeholder="Enter prompt"
                    onChange={(e) => {
                      const val = e.currentTarget.value;
                      dispatch(promptKnowWhatToSeeWithMetric(val));
                    }}
                  />
                </div>
                {!state.aiIsLoading && !state.giveMeAIQueries ? (
                  <>
                    <div className={styles.rightButtonsWrapper}>
                      <div className={styles.rightButtons}>
                        <Button
                          className={styles.leftButton}
                          fill="outline"
                          variant="secondary"
                          onClick={() => {
                            dispatch(askForQueryHelp(false));
                            dispatch(knowWhatYouWantToQuery(false));
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          className={styles.leftButton}
                          fill="outline"
                          variant="secondary"
                          onClick={() => {
                            // JUST SUGGEST QUERIES AND SHOW THE LIST
                            dispatch(knowWhatYouWantToQuery(false));
                            dispatch(giveMeHistoricalQueries(false));
                            // will need to show some loading while fetching historical queries
                          }}
                        >
                          Suggest queries instead
                        </Button>
                        <Button
                          fill="solid"
                          variant="primary"
                          onClick={() => {
                            dispatch(aiIsLoading(true));
                            callOpenAI(dispatch, state.promptKnowWhatToSeeWithMetric);
                          }}
                        >
                          Submit
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {state.aiIsLoading ? (
                      <>
                        <div className={styles.loadingMessageContainer}>
                          Waiting for OpenAI <Spinner className={styles.floatRight} />
                        </div>
                      </>
                    ) : (
                      // LIST OF SUGGESTED QUERIES FROM AI
                      <QuerySuggestionContainer
                        suggestionType={SuggestionType.AI}
                        querySuggestions={querySuggestions}
                      />
                    )}
                  </>
                )}
              </>
            ) : (
              // LIST OF SUGGESTED QUERIES FROM HISTORICAL DATA
              <QuerySuggestionContainer suggestionType={SuggestionType.AI} querySuggestions={querySuggestions} />
            )}
          </>
        )}
      </div>
      {/* Query Explainer, show second drawer */}
      {state.showExplainer && (
        <Drawer width={'25%'} closeOnMaskClick={false} onClose={() => dispatch(showExplainer(false))}>
          <div className={styles.header}>
            <h3>Explainer</h3>
            <Button fill="text" variant="secondary" onClick={() => dispatch(showExplainer(false))}>
              x
            </Button>
          </div>
        </Drawer>
      )}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    sectionPadding: css`
      padding: 20px;
    `,
    header: css`
      display: flex;

      button {
        margin-left: auto;
      }
    `,
    iconSection: css`
      padding: 0 0 10px 0;
      color: ${theme.colors.text.secondary};
    `,
    rightButtonsWrapper: css`
      display: flex;
    `,
    rightButtons: css`
      margin-left: auto;
    `,
    leftButton: css`
      margin-right: 10px;
    `,
    dataList: css`
      padding: 0px 28px 28px 28px;
    `,
    textPadding: css`
      padding-bottom: 15px;
    `,
    containerPadding: css`
      padding: 28px;
    `,
    infoContainer: css`
      border: 1px solid #ccccdc38;
      padding: 28px;
      background-color: #22252b;
      margin-top: 10px;
      margin-bottom: 20px;
      border-radius: 8px 8px 8px 0;
    `,
    metricTable: css`
      width: 100%;
    `,
    metricTableName: css`
      width: 15%;
    `,
    metricTableValue: css`
      font-family: ${theme.typography.fontFamilyMonospace};
      font-size: ${theme.typography.bodySmall.fontSize};
      overflow: wrap;
      max-width: 150px;
      width: 60%;
    `,
    metricTableButton: css`
      margin-left: 10px;
    `,
    queryQuestion: css`
      text-align: end;
      padding: 8px 0;
    `,
    secondaryText: css`
      color: ${theme.colors.text.secondary};
    `,
    loadingMessageContainer: css`
      border: 1px solid #ccccdc38;
      padding: 28px;
      background-color: #22252b;
      margin-top: 10px;
      margin-bottom: 20px;
      border-radius: 8px;
      color: ${theme.colors.text.secondary};
      font-style: italic;
    `,
    floatRight: css`
      float: right;
    `,
    codeText: css`
      font-family: ${theme.typography.fontFamilyMonospace};
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    bodySmall: css`
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    explainPadding: css`
      padding-left: 26px;
    `,
    bottomMargin: css`
      margin-bottom: 20px;
    `,
    topPadding: css`
      padding-top: 22px;
    `,
    doc: css`
      text-decoration: underline;
    `,
  };
};
