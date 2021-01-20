import React, { PureComponent } from 'react';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';
import { DashboardModel } from '../../state/DashboardModel';
import { DecoratedRevisionModel } from '../DashboardSettings/VersionsSettings';

type DiffViewProps = {
  dashboard: DashboardModel;
  isNewLatest: boolean;
  newInfo?: DecoratedRevisionModel;
  baseInfo?: DecoratedRevisionModel;
  delta: { basic: string; json: string };
  onFetchFail: () => void;
};

export class VersionHistoryComparison extends PureComponent<DiffViewProps> {
  element?: HTMLElement | null;
  angularCmp?: AngularComponent;

  constructor(props: DiffViewProps) {
    super(props);
  }

  componentDidMount() {
    const loader = getAngularLoader();
    const template =
      '<gf-dashboard-history dashboard="dashboard" newinfo="newinfo" baseinfo="baseinfo" isnewlatest="isnewlatest" onfetchfail="onfetchfail" delta="delta"/>';
    const scopeProps = {
      dashboard: this.props.dashboard,
      delta: this.props.delta,
      baseinfo: this.props.baseInfo,
      newinfo: this.props.newInfo,
      isnewlatest: this.props.isNewLatest,
      onfetchfail: this.props.onFetchFail,
    };
    this.angularCmp = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.angularCmp) {
      this.angularCmp.destroy();
    }
  }

  render() {
    return <div data-testid="angular-history-comparison" ref={(ref) => (this.element = ref)} />;
  }
}
