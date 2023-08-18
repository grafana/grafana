import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { ExploreItemState, useDispatch, useSelector } from 'app/types';

import { removeCorrelationData } from './state/explorePane';
import { changeCorrelationDetails, changeCorrelationsEditorMode } from './state/main';
import { runQueries, saveCurrentCorrelation } from './state/query';
import { selectCorrelationDetails } from './state/selectors';

export const CorrelationEditorModeBar = ({panes}: {panes: Array<[string, ExploreItemState]>} ) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const correlationDetails = useSelector(selectCorrelationDetails);

  return (
    <div className={styles.correlationEditorTop}>
      <HorizontalGroup spacing="md" justify='flex-end'>
      <Button
        variant='secondary'
        disabled={!correlationDetails?.valid}
        fill='outline'
          onClick={() => {
            dispatch(
              saveCurrentCorrelation(
                correlationDetails?.label,
                correlationDetails?.description
              )
            );
          }}
        >
          Save
        </Button>
        <Button
          variant='secondary'
          fill='outline'
          tooltip="Exit Correlations Editor Mode"
          icon="times"
          onClick={() => {
            dispatch(changeCorrelationsEditorMode({ correlationsEditorMode: false }));
            panes.forEach((pane) => {
              dispatch(removeCorrelationData(pane[0]));
              dispatch(changeCorrelationDetails({label: undefined, description: undefined, valid: false}));
              dispatch(runQueries({ exploreId: pane[0] }));
            });
          }}
          aria-label="exit correlations editor mode"
        >
          Exit Correlation Editor
        </Button>
      </HorizontalGroup>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    correlationEditorTop: css`
      background-color: ${theme.colors.primary.main};
      margin-top: 3px;
      padding: ${theme.spacing(1)}
    `,
  };
}
