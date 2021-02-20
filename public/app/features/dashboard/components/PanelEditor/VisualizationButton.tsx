import React, { FC, useCallback, useState } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, PanelPlugin, PanelPluginMeta } from '@grafana/data';
import { useTheme, stylesFactory, Icon, Input, ToolbarButton, ButtonGroup, Button } from '@grafana/ui';
import { changePanelPlugin } from '../../state/actions';
import { StoreState } from 'app/types';
import { PanelModel } from '../../state/PanelModel';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';
import { VizTypePicker, getAllPanelPluginMeta, filterPluginList } from '../VizTypePicker/VizTypePicker';
import { Field } from '@grafana/ui/src/components/Forms/Field';
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
  changePanelPlugin: typeof changePanelPlugin;
  toggleVizPicker: typeof toggleVizPicker;
  setPanelEditorUIState: typeof setPanelEditorUIState;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VisualizationButtonUnconnected: FC<Props> = ({
  panel,
  plugin,
  changePanelPlugin,
  toggleVizPicker,
  isPanelOptionsVisible,
  isVizPickerOpen,
  setPanelEditorUIState,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const theme = useTheme();
  const styles = getStyles(theme);

  const onPluginTypeChange = (meta: PanelPluginMeta) => {
    if (meta.id === plugin!.meta.id) {
      toggleVizPicker(false);
    } else {
      changePanelPlugin(panel, meta.id);
    }
  };

  const onToggleOpen = () => {
    toggleVizPicker(!isVizPickerOpen);
  };

  const onKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const query = e.currentTarget.value;
        const plugins = getAllPanelPluginMeta();
        const match = filterPluginList(plugins, query, plugin!.meta);
        if (match && match.length) {
          onPluginTypeChange(match[0]);
        }
      }
    },
    [onPluginTypeChange, plugin]
  );

  const onToggleOptionsPane = () => {
    setPanelEditorUIState({ isPanelOptionsVisible: !isPanelOptionsVisible });
  };

  if (!plugin) {
    return null;
  }

  const suffix =
    searchQuery !== '' ? (
      <Button icon="times" variant="link" size="sm" onClick={() => setSearchQuery('')}>
        Clear filter
      </Button>
    ) : null;

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
      {isVizPickerOpen && (
        <div className={styles.openWrapper}>
          <Field>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyPress={onKeyPress}
              prefix={<Icon name="filter" className={styles.icon} />}
              suffix={suffix}
              autoFocus
              placeholder="Filter visualizations"
            />
          </Field>

          <VizTypePicker
            current={plugin.meta}
            onTypeChange={onPluginTypeChange}
            searchQuery={searchQuery}
            onClose={() => {}}
          />
        </div>
      )}
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
  changePanelPlugin,
  toggleVizPicker,
  setPanelEditorUIState,
};

export const VisualizationButton = connect(mapStateToProps, mapDispatchToProps, undefined, { forwardRef: true })(
  VisualizationButtonUnconnected
);
