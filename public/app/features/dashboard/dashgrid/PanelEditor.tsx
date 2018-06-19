import React from 'react';
import { PanelModel } from '../panel_model';
import { DashboardModel } from '../dashboard_model';

interface PanelEditorProps {
  panel: PanelModel;
  dashboard: DashboardModel;
}

export class PanelEditor extends React.Component<PanelEditorProps, any> {
  render() {
    return (
      <div className="tabbed-view tabbed-view--panel-edit">
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

        <div className="tabbed-view-body">testing</div>
      </div>
    );
  }
}
