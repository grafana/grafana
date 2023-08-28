import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { Prompt } from 'react-router-dom';
import { useBeforeUnload } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, HorizontalGroup, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { ExploreItemState, useDispatch, useSelector } from 'app/types';

import { CorrelationUnsavedChangesModal } from './CorrelationUnsavedChangesModal';
import { removeCorrelationData } from './state/explorePane';
import { changeCorrelationDetails, changeCorrelationsEditorMode } from './state/main';
import { runQueries, saveCurrentCorrelation } from './state/query';
import { selectCorrelationDetails, selectCorrelationEditorMode } from './state/selectors';

// we keep component rendered and hidden to avoid race conditions with the prompt
export const CorrelationEditorModeBar = ({
  panes,
  toShow,
}: {
  panes: Array<[string, ExploreItemState]>;
  toShow: boolean;
}) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const correlationDetails = useSelector(selectCorrelationDetails);
  const correlationsEditorMode = useSelector(selectCorrelationEditorMode);
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  // handle refreshing and closing the tab
  useBeforeUnload(correlationDetails?.dirty || false, 'Save correlation?');

  useEffect(() => {
    return () => {
      dispatch(changeCorrelationsEditorMode({ correlationsEditorMode: false }));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // handle exiting (staying within explore)
  useEffect(() => {
    if (!correlationsEditorMode) {
      if (correlationDetails?.dirty) {
        // if we are trying to exit in a dirty state, show prompt
        setShowSavePrompt(true);
      } else if (correlationDetails?.dirty === false) {
        // otherwise, if we are exiting in a not dirty state, reset everything
        setShowSavePrompt(false);
        dispatch(changeCorrelationDetails({ label: undefined, description: undefined, canSave: false }));
        panes.forEach((pane) => {
          dispatch(removeCorrelationData(pane[0]));
          dispatch(runQueries({ exploreId: pane[0] }));
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correlationsEditorMode, correlationDetails?.dirty]);

  return (
    <>
      {/* Handle navigating outside of Explore */}
      <Prompt
        message={(location, action) => {
          if (location.pathname !== '/explore' && correlationsEditorMode && (correlationDetails?.dirty || false)) {
            return 'You have unsaved correlation data. Continue?'
          } else {
            return true;
          }
        }}
      />

      {showSavePrompt && (
        <CorrelationUnsavedChangesModal
          onDiscard={() => {
            // if we are discarding the in progress correlation, reset everything
            dispatch(changeCorrelationDetails({ dirty: false }));
          }}
          onCancel={() => {
            // if we are cancelling the exit, set the editor mode back to true and hide the prompt
            dispatch(changeCorrelationsEditorMode({ correlationsEditorMode: true }));
            setShowSavePrompt(false);
          }}
          onSave={() => {
            dispatch(saveCurrentCorrelation(correlationDetails?.label, correlationDetails?.description));
            dispatch(changeCorrelationDetails({ dirty: false }));
          }}
        />
      )}
      {toShow && (
        <div className={styles.correlationEditorTop}>
          <HorizontalGroup spacing="md" justify="flex-end">
            <Tooltip content="Correlations editor in Explore is an experimental feature.">
              <Icon name="info-circle" size="xl" />
            </Tooltip>
            <Button
              variant="secondary"
              disabled={!correlationDetails?.canSave}
              fill="outline"
              onClick={() => {
                dispatch(saveCurrentCorrelation(correlationDetails?.label, correlationDetails?.description));
              }}
            >
              Save
            </Button>
            <Button
              variant="secondary"
              fill="outline"
              icon="times"
              onClick={() => {
                dispatch(changeCorrelationsEditorMode({ correlationsEditorMode: false }));
              }}
              aria-label="exit correlations editor mode"
            >
              Exit Correlation Editor
            </Button>
          </HorizontalGroup>
        </div>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    correlationEditorTop: css`
      background-color: ${theme.colors.primary.main};
      margin-top: 3px;
      padding: ${theme.spacing(1)};
    `,
  };
};
