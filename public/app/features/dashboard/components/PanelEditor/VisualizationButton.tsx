import { css } from '@emotion/css';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { ToolbarButton, ButtonGroup } from '@grafana/ui';
import { useDispatch, useSelector } from 'app/types';

import { PanelModel } from '../../state';
import { getPanelPluginWithFallback } from '../../state/selectors';

import { updatePanelEditorUIState } from './state/actions';
import { toggleVizPicker } from './state/reducers';

type Props = {
  panel: PanelModel;
};

export const VisualizationButton = ({ panel }: Props) => {
  const dispatch = useDispatch();
  const plugin = useSelector(getPanelPluginWithFallback(panel.type));
  const isPanelOptionsVisible = useSelector((state) => state.panelEditor.ui.isPanelOptionsVisible);
  const isVizPickerOpen = useSelector((state) => state.panelEditor.isVizPickerOpen);

  const onToggleOpen = () => {
    dispatch(toggleVizPicker(!isVizPickerOpen));
  };

  const onToggleOptionsPane = () => {
    dispatch(updatePanelEditorUIState({ isPanelOptionsVisible: !isPanelOptionsVisible }));
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
          data-testid={selectors.components.PanelEditor.toggleVizPicker}
          aria-label="Change Visualization"
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
          data-testid={selectors.components.PanelEditor.toggleVizOptions}
          aria-label={isPanelOptionsVisible ? 'Close options pane' : 'Show options pane'}
        />
      </ButtonGroup>
    </div>
  );
};

VisualizationButton.displayName = 'VisualizationTab';

const styles = {
  wrapper: css`
    display: flex;
    flex-direction: column;
  `,
  vizButton: css`
    text-align: left;
  `,
};
