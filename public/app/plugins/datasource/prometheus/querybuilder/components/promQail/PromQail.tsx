import { css } from '@emotion/css';
import React, { useReducer } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Checkbox, Drawer, useTheme2 } from '@grafana/ui';
import store from 'app/core/store';

import { PromVisualQuery } from '../../types';

import { initialState, stateSlice } from './state/state';

// actions to update the state
const { showStartingMessage, showExplainer, indicateCheckbox, askForQueryHelp } = stateSlice.actions;

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
        <div className={styles.iconSection}>[ai] Assistant</div>
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
            <div className={styles.nextButtonsWrapper}>
              <div className={styles.nextButtons}>
                <Button fill="outline" variant="secondary" onClick={closeDrawer}>
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
            <div className={styles.textPadding}>Here are the metrics you have selected:</div>
            <div className={styles.metricContainer}>
              <div>Metric: {state.query.metric}</div>
              <div>Labels: {state.query.labels.toString()}</div>
            </div>

            {!state.askForQueryHelp ? (
              <>
                <div>Do you know what you want to query?</div>
                <div className={styles.nextButtonsWrapper}>
                  <div className={styles.nextButtons}>
                    <Button fill="solid" variant="secondary" onClick={() => dispatch(askForQueryHelp(true))}>
                      No
                    </Button>
                    <Button fill="solid" variant="primary" onClick={closeDrawer}>
                      Yes
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div>LIST OF QUERIES</div>
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
        margin-right: 10px;
      }
    `,
    iconSection: css`
      padding: 10px 0;
    `,
    nextButtonsWrapper: css`
      display: flex;
    `,
    nextButtons: css`
      margin-left: auto;

      button {
        margin-right: 10px;
      }
    `,
    dataList: css`
      padding: 0px 28px 28px 28px;
    `,
    textPadding: css`
      padding-bottom: 20px;
    `,
    containerPadding: css`
      padding: 28px;
    `,
    metricContainer: css`
      border: 1px solid #ccccdc38;
      padding: 28px;
      background-color: #22252b;
      margin-top: 10px;
      margin-bottom: 20px;
      border-radius: 8px 8px 8px 0;
    `,
  };
};
