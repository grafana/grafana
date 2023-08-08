import { css } from '@emotion/css';
import React, { useReducer } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Drawer, useTheme2 } from '@grafana/ui';

import { PromVisualQuery } from '../../types';

import { initialState, stateSlice } from './state/state';

// actions to update the state
const { showExplainer } = stateSlice.actions;

export type PromQailProps = {
  query: PromVisualQuery;
  closeDrawer: () => void;
};

export const PromQail = (props: PromQailProps) => {
  const { query, closeDrawer } = props;

  const [state, dispatch] = useReducer(stateSlice.reducer, initialState(query));

  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <>
      {/* Query Advisor */}
      {/* header */}
      <div className={styles.header}>
        <h3>Query advisor</h3>
        <Button fill="text" variant="secondary" onClick={closeDrawer}>
          x
        </Button>
      </div>
      {/* Starting message */}
      {state.showStartingMessage && (
        <>
          <div>[ai] Assistant</div>
          {/* don't show this message again, store in localstorage */}
          <div className={styles.nextButtonsWrapper}>
            <div className={styles.nextButtons}>
              <Button fill="outline" variant="secondary" onClick={closeDrawer}>
                Cancel
              </Button>
              <Button fill="solid" variant="primary" onClick={() => dispatch(showExplainer(true))}>
                Continue
              </Button>
            </div>
          </div>
        </>
      )}
      {/* Query Explainer, show second drawer */}
      {state.showExplainer && (
        <Drawer closeOnMaskClick={false} onClose={() => dispatch(showExplainer(false))}>
          <div className={styles.header}>
            <h3>Explainer</h3>
            <Button fill="text" variant="secondary" onClick={() => dispatch(showExplainer(false))}>
              x
            </Button>
          </div>
        </Drawer>
      )}
    </>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css`
      display: flex;

      button {
        margin-left: auto;
        margin-right: 10px;
      }
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
  };
};
