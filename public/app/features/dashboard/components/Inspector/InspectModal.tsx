// Libraries
import React, { PureComponent } from 'react';

import { PanelModel } from 'app/features/dashboard/state/PanelModel';

interface Props {
  panel: PanelModel;
}

export class InspectModal extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  componentDidMount = () => {
    console.log('TODO, inspect', panel);
    console.log('DATA', panel.getQueryRunner());
  };

  render() {
    const { panel } = this.props;
    return (
      <div className="modal-body">
        <div className="modal-header">
          <h2 className="modal-header-title">
            <i className="fa fa-fw fa-info-circle" />
            <span className="p-l-1">Inspect: {panel.title}</span>
          </h2>

          <a className="modal-header-close" ng-click="dismiss();">
            <i className="fa fa-remove" />
          </a>
        </div>

        <div className="modal-content">
          <div className="gf-form-group">
            <div className="gf-form">
              <span className="gf-form-label">Key</span>
              <span className="gf-form-label">{this.props.panel.id}</span>
            </div>
          </div>

          <div className="grafana-info-box" style={{ border: 0 }}>
            TODO....
          </div>
        </div>
      </div>
    );
  }
}
