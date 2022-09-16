import { css } from '@emotion/css';
import React, { FC } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ToolbarButton, ButtonGroup, useStyles } from '@grafana/ui';
import { StoreState } from 'app/types';

import { PanelModel } from '../../state';
import { getPanelPluginWithFallback } from '../../state/selectors';

import { setPanelEditorUIState, toggleVizPicker } from './state/reducers';

type Props = {
  panel: PanelModel;
};

export const VisualizationButton: FC<Props> = ({ panel }) => {
  const styles = useStyles(getStyles);
  const dispatch = useDispatch();
  const plugin = useSelector(getPanelPluginWithFallback(panel.type));
  const isPanelOptionsVisible = useSelector((state: StoreState) => state.panelEditor.ui.isPanelOptionsVisible);
  const isVizPickerOpen = useSelector((state: StoreState) => state.panelEditor.isVizPickerOpen);

  const onToggleOpen = () => {
    dispatch(toggleVizPicker(!isVizPickerOpen));
  };

  const onToggleOptionsPane = () => {
    dispatch(setPanelEditorUIState({ isPanelOptionsVisible: !isPanelOptionsVisible }));
  };

  if (!plugin) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <ButtonGroup>
        <ToolbarButton
          className={styles.vizButton}
          tooltip="Click to change visualization"
          imgSrc={plugin.meta.info.logos.small}
          isOpen={isVizPickerOpen}
          onClick={onToggleOpen}
          aria-label={selectors.components.PanelEditor.toggleVizPicker}
          variant="canvas"
          fullWidth
        >
          {plugin.meta.name}
        </ToolbarButton>
        <ToolbarButton
          tooltip={isPanelOptionsVisible ? 'Close options pane' : 'Show options pane'}
          icon={isPanelOptionsVisible ? 'angle-right' : 'angle-left'}
          onClick={onToggleOptionsPane}
          variant="canvas"
          aria-label={selectors.components.PanelEditor.toggleVizOptions}
        />
      </ButtonGroup>
    </div>
  );
};

VisualizationButton.displayName = 'VisualizationTab';

const getStyles = (theme: GrafanaTheme) => {
  return {
    wrapper: css`
      display: flex;
      flex-direction: column;
    `,
    vizButton: css`
      text-align: left;
    `,
  };
};
