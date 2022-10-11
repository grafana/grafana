import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { config } from '@grafana/runtime';
import { PanelChrome as PanelChromeUI } from '@grafana/ui';
import { StoreState } from 'app/types';

import { initPanelState } from '../../panel/state/actions';
import { setPanelInstanceState } from '../../panel/state/reducers';
import { DashboardModel, PanelModel } from '../state';

import { LazyLoader } from './LazyLoader';
import { PanelChrome } from './PanelChrome';
import { PanelChromeAngular } from './PanelChromeAngular';

export interface OwnProps {
  panel: PanelModel;
  stateKey: string;
  dashboard: DashboardModel;
  isEditing: boolean;
  isViewing: boolean;
  width: number;
  height: number;
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
  setPanelInstanceState,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

const newPanelChromeUIFlag = Boolean(config.featureToggles.newPanelChromeUI);

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

  renderPanelChrome = (isInView: boolean) => {
    const { plugin } = this.props;
    if (!plugin) {
      return null;
    }

    const { panel, dashboard, isEditing, isViewing, width, height } = this.props;

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
    } else if (newPanelChromeUIFlag) {
      const PanelComponent = plugin.panel!;
      return (
        <PanelChromeUI width={200} height={200}>
          <PanelComponent
            id={panel.id}
            data={data}
            title={panel.title}
            timeRange={timeRange}
            timeZone={this.props.dashboard.getTimezone()}
            options={panelOptions}
            fieldConfig={panel.fieldConfig}
            transparent={panel.transparent}
            width={panelWidth}
            height={innerPanelHeight}
            renderCounter={renderCounter}
            replaceVariables={panel.replaceVariables}
            onOptionsChange={this.onOptionsChange}
            onFieldConfigChange={this.onFieldConfigChange}
            onChangeTimeRange={this.onChangeTimeRange}
            eventBus={dashboard.events}
          />
        </PanelChromeUI>
      );
    } else {
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
          onInstanceStateChange={this.onInstanceStateChange}
        />
      );
    }
  };

  render() {
    const { width, height, lazy } = this.props;

    return lazy ? (
      <LazyLoader width={width} height={height} onChange={this.onVisibilityChange} onLoad={this.onPanelLoad}>
        {({ isInView }) => this.renderPanelChrome(isInView)}
      </LazyLoader>
    ) : (
      this.renderPanelChrome(true)
    );
  }
}

export const DashboardPanel = connector(DashboardPanelUnconnected);
