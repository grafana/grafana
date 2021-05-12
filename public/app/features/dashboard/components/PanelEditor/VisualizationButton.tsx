import React, { FC } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme, PanelPlugin } from '@grafana/data';
import { ToolbarButton, ButtonGroup, useStyles } from '@grafana/ui';
import { StoreState } from 'app/types';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';
import { setPanelEditorUIState, toggleVizPicker } from './state/reducers';
import { selectors } from '@grafana/e2e-selectors';
import { PanelModel } from '../../state';

interface OwnProps {
  panel: PanelModel;
}

interface ConnectedProps {
  plugin?: PanelPlugin;
  isVizPickerOpen: boolean;
  isPanelOptionsVisible: boolean;
}

interface DispatchProps {
  toggleVizPicker: typeof toggleVizPicker;
  setPanelEditorUIState: typeof setPanelEditorUIState;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VisualizationButtonUnconnected: FC<Props> = ({
  plugin,
  toggleVizPicker,
  isPanelOptionsVisible,
  isVizPickerOpen,
  setPanelEditorUIState,
}) => {
  const styles = useStyles(getStyles);

  const onToggleOpen = () => {
    toggleVizPicker(!isVizPickerOpen);
  };

  const onToggleOptionsPane = () => {
    setPanelEditorUIState({ isPanelOptionsVisible: !isPanelOptionsVisible });
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
          fullWidth
        >
          {plugin.meta.name}
        </ToolbarButton>
        <ToolbarButton
          tooltip={isPanelOptionsVisible ? 'Close options pane' : 'Show options pane'}
          icon={isPanelOptionsVisible ? 'angle-right' : 'angle-left'}
          onClick={onToggleOptionsPane}
          aria-label={selectors.components.PanelEditor.toggleVizOptions}
        />
      </ButtonGroup>
    </div>
  );
};

VisualizationButtonUnconnected.displayName = 'VisualizationTabUnconnected';

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

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  return {
    plugin: state.plugins.panels[props.panel.type],
    isPanelOptionsVisible: state.panelEditor.ui.isPanelOptionsVisible,
    isVizPickerOpen: state.panelEditor.isVizPickerOpen,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  toggleVizPicker,
  setPanelEditorUIState,
};

export const VisualizationButton = connect(mapStateToProps, mapDispatchToProps, undefined, { forwardRef: true })(
  VisualizationButtonUnconnected
);
