import React, { FC } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, PanelPlugin } from '@grafana/data';
import { useTheme, stylesFactory, ToolbarButton, ButtonGroup } from '@grafana/ui';
import { StoreState } from 'app/types';
import { PanelModel } from '../../state/PanelModel';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';
import { setPanelEditorUIState, toggleVizPicker } from './state/reducers';
import { selectors } from '@grafana/e2e-selectors';

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
  const theme = useTheme();
  const styles = getStyles(theme);

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
          tooltip="Click to change visualisation"
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
          icon="sliders-v-alt"
          onClick={onToggleOptionsPane}
          isOpen={isPanelOptionsVisible}
          aria-label={selectors.components.PanelEditor.toggleVizOptions}
        />
      </ButtonGroup>
    </div>
  );
};

VisualizationButtonUnconnected.displayName = 'VisualizationTabUnconnected';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    icon: css`
      color: ${theme.palette.gray33};
    `,
    wrapper: css`
      display: flex;
      flex-direction: column;
    `,
    vizButton: css`
      text-align: left;
    `,
    openWrapper: css`
      padding-top: ${theme.spacing.md};
    `,
  };
});

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
