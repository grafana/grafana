import React, { FC } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, PanelPlugin, PanelPluginMeta } from '@grafana/data';
import { useTheme, stylesFactory } from '@grafana/ui';
import { changePanelPlugin } from '../../state/actions';
import { StoreState } from 'app/types';
import { PanelModel } from '../../state/PanelModel';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';
import { VizTypePicker } from '../../panel_editor/VizTypePicker';

interface OwnProps {
  panel: PanelModel;
}

interface ConnectedProps {
  plugin?: PanelPlugin;
}

interface DispatchProps {
  changePanelPlugin: typeof changePanelPlugin;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VisualizationTabUnconnected: FC<Props> = ({ panel, plugin, changePanelPlugin }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  if (!plugin) {
    return null;
  }

  const onPluginTypeChange = (meta: PanelPluginMeta) => {
    changePanelPlugin(panel, meta.id);
  };

  return (
    <div className={styles.wrapper}>
      <VizTypePicker current={plugin.meta} onTypeChange={onPluginTypeChange} searchQuery={''} onClose={() => {}} />
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    wrapper: css`
      padding: ${theme.spacing.md};
    `,
  };
});

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  return {
    plugin: state.plugins.panels[props.panel.type],
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = { changePanelPlugin };

export const VisualizationTab = connect(mapStateToProps, mapDispatchToProps)(VisualizationTabUnconnected);
