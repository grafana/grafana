// Libraries
import React, { PureComponent } from 'react';
import classNames from 'classnames';
import AutoSizer from 'react-virtualized-auto-sizer';
import { connect, ConnectedProps } from 'react-redux';

// Components
import { PanelChrome } from './PanelChrome';
import { PanelChromeAngular } from './PanelChromeAngular';

// Actions
import { initDashboardPanel } from '../state/actions';

// Types
import { DashboardModel, PanelModel } from '../state';
import { StoreState } from 'app/types';
import { GrafanaTheme, PanelPlugin } from '@grafana/data';
import { stylesFactory, Themeable, withTheme } from '@grafana/ui';
import { css } from 'emotion';

export interface OwnProps {
  panel: PanelModel;
  dashboard: DashboardModel;
  isEditing: boolean;
  isViewing: boolean;
  isInView: boolean;
}

export interface State {
  isLazy: boolean;
}

const mapStateToProps = (state: StoreState, props: OwnProps) => {
  const panelState = state.dashboard.panels[props.panel.id];
  if (!panelState) {
    return { plugin: null };
  }

  return {
    plugin: panelState.plugin,
  };
};

const mapDispatchToProps = { initDashboardPanel };

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & Themeable & ConnectedProps<typeof connector>;

export class UnthemedDashboardPanelUnconnected extends PureComponent<Props, State> {
  specialPanels: { [key: string]: Function } = {};

  constructor(props: Props) {
    super(props);

    this.state = {
      isLazy: !props.isInView,
    };
  }

  componentDidMount() {
    this.props.initDashboardPanel(this.props.panel);
  }

  componentDidUpdate() {
    if (this.state.isLazy && this.props.isInView) {
      this.setState({ isLazy: false });
    }
  }

  renderPanel(plugin: PanelPlugin) {
    const { dashboard, panel, isViewing, isInView, isEditing } = this.props;

    return (
      <AutoSizer>
        {({ width, height }) => {
          if (width === 0) {
            return null;
          }

          if (plugin.angularPanelCtrl) {
            return (
              <PanelChromeAngular
                plugin={plugin}
                panel={panel}
                dashboard={dashboard}
                isViewing={isViewing}
                isEditing={isEditing}
                isInView={isInView}
                width={width}
                height={height}
              />
            );
          }

          return (
            <PanelChrome
              plugin={plugin}
              panel={panel}
              dashboard={dashboard}
              isViewing={isViewing}
              isEditing={isEditing}
              isInView={isInView}
              width={width}
              height={height}
            />
          );
        }}
      </AutoSizer>
    );
  }

  render() {
    const { isViewing, plugin, theme } = this.props;
    const { isLazy } = this.state;
    const styles = getStyles(theme);

    // If we have not loaded plugin exports yet, wait
    if (!plugin) {
      return null;
    }

    // If we are lazy state don't render anything
    if (isLazy) {
      return null;
    }

    return (
      <div
        className={isViewing === true ? classNames(styles.panelWrapper, styles.panelWrapperView) : styles.panelWrapper}
      >
        {this.renderPanel(plugin)}
      </div>
    );
  }
}

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    panelWrapper: css`
      height: 100%;
      position: relative;
    `,
    panelWrapperView: css`
      flex: 1 1 0;
      height: 90%;
    `,
  };
});
export const DashboardPanelUnconnected = withTheme(UnthemedDashboardPanelUnconnected);
DashboardPanelUnconnected.displayName = 'UnthemedDashboardPanelUnconnected';
export const DashboardPanel = connector(DashboardPanelUnconnected);
