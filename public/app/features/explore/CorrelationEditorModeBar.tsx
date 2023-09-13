import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { Prompt } from 'react-router-dom';
import { useBeforeUnload } from 'react-use';

import { GrafanaTheme2, colorManipulator } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { ExploreItemState, useDispatch, useSelector } from 'app/types';

import { CorrelationUnsavedChangesModal } from './CorrelationUnsavedChangesModal';
import { removeCorrelationHelperData } from './state/explorePane';
import { changeCorrelationEditorDetails, splitClose } from './state/main';
import { runQueries, saveCurrentCorrelation } from './state/query';
import { selectCorrelationDetails } from './state/selectors';

// we keep component rendered and hidden to avoid race conditions with the prompt
export const CorrelationEditorModeBar = ({ panes }: { panes: Array<[string, ExploreItemState]> }) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const correlationDetails = useSelector(selectCorrelationDetails);
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  // handle refreshing and closing the tab
  useBeforeUnload(correlationDetails?.dirty || false, 'Save correlation?');

  // handle exiting (staying within explore)
  useEffect(() => {
    if (correlationDetails?.isExiting && correlationDetails?.dirty) {
      setShowSavePrompt(true);
    } else if (correlationDetails?.isExiting && !correlationDetails?.dirty) {
      dispatch(
        changeCorrelationEditorDetails({
          editorMode: false,
          dirty: false,
          isExiting: false,
          closePaneExploreId: undefined,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correlationDetails?.dirty, correlationDetails?.isExiting]);

  // clear data when unmounted
  useEffect(() => {
    return () => {
      dispatch(
        changeCorrelationEditorDetails({
          editorMode: false,
          isExiting: false,
          dirty: false,
          label: undefined,
          description: undefined,
          canSave: false,
          closePaneExploreId: undefined,
        })
      );
      panes.forEach((pane) => {
        dispatch(removeCorrelationHelperData(pane[0]));
        dispatch(runQueries({ exploreId: pane[0] }));
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closePane = (exploreId: string) => {
    setShowSavePrompt(false);
    dispatch(splitClose(exploreId));
    reportInteraction('grafana_explore_split_view_closed');
    dispatch(
      changeCorrelationEditorDetails({
        editorMode: true,
        isExiting: false,
        dirty: false,
        label: undefined,
        description: undefined,
        canSave: false,
        closePaneExploreId: undefined,
      })
    );
  };

  return (
    <>
      {/* Handle navigating outside of Explore */}
      <Prompt
        message={(location) => {
          if (
            location.pathname !== '/explore' &&
            (correlationDetails?.editorMode || false) &&
            (correlationDetails?.dirty || false)
          ) {
            return 'You have unsaved correlation data. Continue?';
          } else {
            return true;
          }
        }}
      />

      {showSavePrompt && (
        <CorrelationUnsavedChangesModal
          onDiscard={() => {
            if (correlationDetails?.closePaneExploreId !== undefined) {
              closePane(correlationDetails?.closePaneExploreId);
            } else {
              // exit correlations mode
              // if we are discarding the in progress correlation, reset everything
              // this modal only shows if the editorMode is false, so we just need to update the dirty state
              dispatch(
                changeCorrelationEditorDetails({
                  editorMode: false,
                  dirty: false,
                  isExiting: false,
                  closePaneExploreId: undefined,
                })
              );
            }
          }}
          onCancel={() => {
            // if we are cancelling the exit, set the editor mode back to true and hide the prompt
            dispatch(changeCorrelationEditorDetails({ isExiting: false, closePaneExploreId: undefined }));
            setShowSavePrompt(false);
          }}
          onSave={() => {
            dispatch(saveCurrentCorrelation(correlationDetails?.label, correlationDetails?.description));
            if (correlationDetails?.closePaneExploreId !== undefined) {
              closePane(correlationDetails?.closePaneExploreId);
            } else {
              dispatch(changeCorrelationEditorDetails({ editorMode: false, dirty: false, isExiting: false }));
            }
          }}
        />
      )}
      <div className={styles.correlationEditorTop}>
        <HorizontalGroup spacing="md" justify="flex-end">
          <Tooltip content="Correlations editor in Explore is an experimental feature.">
            <Icon className={styles.iconColor} name="info-circle" size="xl" />
          </Tooltip>
          <Button
            variant="secondary"
            disabled={!correlationDetails?.canSave}
            fill="outline"
            className={correlationDetails?.canSave ? styles.buttonColor : styles.disabledButtonColor}
            onClick={() => {
              dispatch(changeCorrelationEditorDetails({ dirty: false }));
              dispatch(saveCurrentCorrelation(correlationDetails?.label, correlationDetails?.description));
            }}
          >
            Save
          </Button>
          <Button
            variant="secondary"
            fill="outline"
            className={styles.buttonColor}
            icon="times"
            onClick={() => {
              dispatch(changeCorrelationEditorDetails({ isExiting: true }));
            }}
            aria-label="exit correlations editor mode"
          >
            Exit Correlation Editor
          </Button>
        </HorizontalGroup>
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const contrastColor = theme.colors.getContrastText(theme.colors.primary.main);
  const lighterBackgroundColor = colorManipulator.lighten(theme.colors.primary.main, 0.1);
  const darkerBackgroundColor = colorManipulator.darken(theme.colors.primary.main, 0.2);

  const disabledColor = colorManipulator.darken(contrastColor, 0.2);

  return {
    correlationEditorTop: css`
      background-color: ${theme.colors.primary.main};
      margin-top: 3px;
      padding: ${theme.spacing(1)};
    `,
    iconColor: css`
      color: ${contrastColor};
    `,
    buttonColor: css`
      color: ${contrastColor};
      border-color: ${contrastColor};
      &:hover {
        color: ${contrastColor};
        border-color: ${contrastColor};
        background-color: ${lighterBackgroundColor};
      }
    `,
    // important needed to override disabled state styling
    disabledButtonColor: css`
      color: ${disabledColor} !important;
      background-color: ${darkerBackgroundColor} !important;
    `,
  };
};
