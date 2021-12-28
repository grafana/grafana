import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { PanelChrome } from './PanelChrome';
import { PanelChromeAngular } from './PanelChromeAngular';
import { DashboardModel, PanelModel } from '../state';
import { StoreState } from 'app/types';
import { PanelPlugin } from '@grafana/data';
import { cleanUpPanelState, setPanelInstanceState } from '../../panel/state/reducers';
import { initPanelState } from '../../panel/state/actions';
import { LazyLoader } from './LazyLoader';

export interface OwnProps {
  panel: PanelModel;
  stateKey: string;
  dashboard: DashboardModel;
  isEditing: boolean;
  isViewing: boolean;
  width: number;
  height: number;
  skipStateCleanUp?: boolean;
  lazy?: boolean;
}

const mapStateToProps = (state: StoreState, props: OwnProps) => {
  const panelState = state.panels[props.stateKey];
  if (!panelState) {
    return { plugin: null };
  }

  return {
    plugin: panelState.plugin,
    instanceState: panelState.instanceState,
  };
};

const mapDispatchToProps = {
  initPanelState,
  cleanUpPanelState,
  setPanelInstanceState,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export class DashboardPanelUnconnected extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    lazy: true,
  };

  specialPanels: { [key: string]: Function } = {};

  componentDidMount() {
    this.props.panel.isInView = !this.props.lazy;
    if (!this.props.plugin) {
      this.props.initPanelState(this.props.panel);
    }
  }

  componentWillUnmount() {
    // Most of the time an unmount should result in cleanup but in PanelEdit it should not
    if (!this.props.skipStateCleanUp) {
      this.props.cleanUpPanelState({ key: this.props.stateKey });
    }
  }

  onInstanceStateChange = (value: any) => {
    this.props.setPanelInstanceState({ key: this.props.stateKey, value });
  };

  onVisibilityChange = (v: boolean) => {
    this.props.panel.isInView = v;
  };

  renderPanel(plugin: PanelPlugin) {
    const { dashboard, panel, isViewing, isEditing, width, height, lazy } = this.props;

    const renderPanelChrome = (isInView: boolean) =>
      plugin.angularPanelCtrl ? (
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
      ) : (
        <PanelChrome
          plugin={plugin}
          panel={panel}
          dashboard={dashboard}
          isViewing={isViewing}
          isEditing={isEditing}
          isInView={isInView}
          width={width}
          height={height}
          onInstanceStateChange={this.onInstanceStateChange}
        />
      );

    return lazy ? (
      <LazyLoader width={width} height={height} onChange={this.onVisibilityChange}>
        {({ isInView }) => renderPanelChrome(isInView)}
      </LazyLoader>
    ) : (
      renderPanelChrome(true)
    );
  }

  render() {
    const { plugin } = this.props;

    // If we have not loaded plugin exports yet, wait
    if (!plugin) {
      return null;
    }

    return this.renderPanel(plugin);
  }
}

export const DashboardPanel = connector(DashboardPanelUnconnected);
