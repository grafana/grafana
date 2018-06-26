import React from 'react';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';
import { getAngularLoader, AngularComponent } from 'app/core/services/angular_loader';

interface PanelEditorProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class PanelEditor extends React.Component<PanelEditorProps, any> {
  queryElement: any;
  queryComp: AngularComponent;
  tabs: any[];

  constructor(props) {
    super(props);

    this.tabs = [
      { id: 'queries', text: 'Queries', icon: 'fa fa-database' },
      { id: 'viz', text: 'Visualization', icon: 'fa fa-line-chart' },
    ];
  }

  componentDidMount() {
    if (!this.queryElement) {
      return;
    }

    let loader = getAngularLoader();
    var template = '<metrics-tab />';
    let scopeProps = {
      ctrl: {
        panel: this.props.panel,
        dashboard: this.props.dashboard,
        panelCtrl: {
          panel: this.props.panel,
          dashboard: this.props.dashboard,
        },
      },
    };

    this.queryComp = loader.load(this.queryElement, scopeProps, template);
  }

  onChangeTab = tabName => {};

  render() {
    return (
      <div className="tabbed-view tabbed-view--panel-edit-new">
        <div className="tabbed-view-header">
          <ul className="gf-tabs">
            <li className="gf-tabs-item">
              <a className="gf-tabs-link active">Queries</a>
            </li>
            <li className="gf-tabs-item">
              <a className="gf-tabs-link">Visualization</a>
            </li>
          </ul>

          <button className="tabbed-view-close-btn" ng-click="ctrl.exitFullscreen();">
            <i className="fa fa-remove" />
          </button>
        </div>

        <div className="tabbed-view-body">
          <div ref={element => (this.queryElement = element)} className="panel-height-helper" />
        </div>
      </div>
    );
  }
}
