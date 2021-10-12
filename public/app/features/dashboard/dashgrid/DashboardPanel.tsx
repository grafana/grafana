import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { PanelChrome } from './PanelChrome';
import { PanelChromeAngular } from './PanelChromeAngular';
import { DashboardModel, PanelModel } from '../state';
import { StoreState } from 'app/types';
import { PanelPlugin } from '@grafana/data';
import { initPanelState } from '../../panel/state/actions';
import { cleanUpPanelState } from '../../panel/state/reducers';

export interface OwnProps {
  panel: PanelModel;
  stateKey: string;
  dashboard: DashboardModel;
  isEditing: boolean;
  isViewing: boolean;
  isInView: boolean;
  width: number;
  height: number;
  skipStateCleanUp?: boolean;
}

export interface State {
  isLazy: boolean;
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
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export class DashboardPanelUnconnected extends PureComponent<Props, State> {
  specialPanels: { [key: string]: Function } = {};

  constructor(props: Props) {
    super(props);

    this.state = {
      isLazy: !props.isInView,
    };
  }

  componentDidMount() {
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

  componentDidUpdate() {
    if (this.state.isLazy && this.props.isInView) {
      this.setState({ isLazy: false });
    }
  }

  renderPanel(plugin: PanelPlugin) {
    const { dashboard, panel, isViewing, isInView, isEditing, width, height } = this.props;

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
  }

  render() {
    const { plugin } = this.props;
    const { isLazy } = this.state;

    // If we have not loaded plugin exports yet, wait
    if (!plugin) {
      return null;
    }

    // If we are lazy state don't render anything
    if (isLazy) {
      return null;
    }

    return this.renderPanel(plugin);
  }
}

export const DashboardPanel = connector(DashboardPanelUnconnected);
