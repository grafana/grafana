import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { StoreState } from 'app/types';

import { initPanelState } from '../../panel/state/actions';
import { setPanelInstanceState } from '../../panel/state/reducers';
import { DashboardModel, PanelModel } from '../state';

import { LazyLoader } from './LazyLoader';
import { PanelChromeAngular } from './PanelChromeAngular';
import { PanelStateWrapper } from './PanelStateWrapper';

export interface OwnProps {
  panel: PanelModel;
  stateKey: string;
  dashboard: DashboardModel;
  isEditing: boolean;
  isViewing: boolean;
  width: number;
  height: number;
  lazy?: boolean;
  timezone?: string;
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
  setPanelInstanceState,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export class DashboardPanelUnconnected extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    lazy: true,
  };

  componentDidMount() {
    this.props.panel.isInView = !this.props.lazy;
    if (!this.props.lazy) {
      this.onPanelLoad();
    }
  }

  onInstanceStateChange = (value: any) => {
    this.props.setPanelInstanceState({ key: this.props.stateKey, value });
  };

  onVisibilityChange = (v: boolean) => {
    this.props.panel.isInView = v;
  };

  onPanelLoad = () => {
    if (!this.props.plugin) {
      this.props.initPanelState(this.props.panel);
    }
  };

  renderPanel = (isInView: boolean) => {
    const { dashboard, panel, isViewing, isEditing, width, height, plugin, timezone } = this.props;

    if (!plugin) {
      return null;
    }

    if (plugin && plugin.angularPanelCtrl) {
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
      <PanelStateWrapper
        plugin={plugin}
        panel={panel}
        dashboard={dashboard}
        isViewing={isViewing}
        isEditing={isEditing}
        isInView={isInView}
        width={width}
        height={height}
        onInstanceStateChange={this.onInstanceStateChange}
        timezone={timezone}
      />
    );
  };

  render() {
    const { width, height, lazy } = this.props;

    return lazy ? (
      <LazyLoader width={width} height={height} onChange={this.onVisibilityChange} onLoad={this.onPanelLoad}>
        {this.renderPanel}
      </LazyLoader>
    ) : (
      this.renderPanel(true)
    );
  }
}

export const DashboardPanel = connector(DashboardPanelUnconnected);
