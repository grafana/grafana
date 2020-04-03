import React, { FC, useState } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, PanelPlugin, PanelPluginMeta } from '@grafana/data';
import { CustomScrollbar, useTheme, stylesFactory, Icon, Input } from '@grafana/ui';
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
  const [searchQuery, setSearchQuery] = useState('');
  const theme = useTheme();
  const styles = getStyles(theme);

  if (!plugin) {
    return null;
  }

  const onPluginTypeChange = (meta: PanelPluginMeta) => {
    changePanelPlugin(panel, meta.id);
  };
  const suffix =
    searchQuery !== '' ? (
      <span className={styles.searchClear} onClick={() => setSearchQuery('')}>
        <Icon name="times" />
        Clear filter
      </span>
    ) : null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.search}>
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          prefix={<Icon name="filter" className={styles.icon} />}
          suffix={suffix}
          placeholder="Filter visualisations"
          autoFocus
        />
      </div>
      <div className={styles.visList}>
        <CustomScrollbar>
          <VizTypePicker
            current={plugin.meta}
            onTypeChange={onPluginTypeChange}
            searchQuery={searchQuery}
            onClose={() => {}}
          />
        </CustomScrollbar>
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    icon: css`
      color: ${theme.colors.gray33};
    `,
    wrapper: css`
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      max-height: 100%;
    `,
    search: css`
      padding: ${theme.spacing.sm} ${theme.spacing.md};
      flex-grow: 0;
      flex-shrink: 1;
      margin-bottom: ${theme.spacing.sm};
    `,
    searchClear: css`
      color: ${theme.colors.gray60};
      cursor: pointer;
    `,
    visList: css`
      flex-grow: 1;
      height: 100%;
      overflow: hidden;
      padding-left: ${theme.spacing.md};
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
