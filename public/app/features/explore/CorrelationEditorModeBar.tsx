import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, HorizontalGroup, useStyles2 } from '@grafana/ui';
import { ExploreItemState, useDispatch, useSelector } from 'app/types';

import { DashNavButton } from '../dashboard/components/DashNav/DashNavButton';

import { removeCorrelationData } from './state/explorePane';
import { changeCorrelationsEditorMode } from './state/main';
import { runQueries, saveCurrentCorrelation } from './state/query';
import { selectCorrelationDetails } from './state/selectors';

export const CorrelationEditorModeBar = ({panes}: {panes: Array<[string, ExploreItemState]>} ) => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  const correlationDetails = useSelector(selectCorrelationDetails);

  return (
    <div className={styles.correlationEditorTop}>
      <HorizontalGroup spacing="md">
        <DashNavButton
          key="x"
          tooltip="Exit Correlations Editor Mode"
          icon="times"
          onClick={() => {
            dispatch(changeCorrelationsEditorMode({ correlationsEditorMode: false }));
            panes.forEach((pane) => {
              dispatch(removeCorrelationData(pane[0]));
              dispatch(runQueries({ exploreId: pane[0] }));
            });
          }}
          aria-label="exit correlations editor mode"
        >
          Exit Correlation Editor
        </DashNavButton>
        <Button
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
      </HorizontalGroup>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    correlationEditorTop: css`
      background-color: ${theme.colors.primary.main};
      margin-top: 3px;
    `,
  };
}
