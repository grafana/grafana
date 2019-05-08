// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelModel } from '../state/PanelModel';

import { FormLabel } from '@grafana/ui';
import { validateReference } from '../state/PanelReference';

interface Props {
  panel: PanelModel;
  onReferenceChanged: () => void;
}

interface State {
  path: string;
}

export class GeneralTabReference extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      path: '',
    };
  }

  loadDashboard = () => {
    const { path } = this.state;
    if (path) {
      validateReference(path).then(info => {
        console.log('TODO', info);
        const { panel, onReferenceChanged } = this.props;
        panel.reference = info.toPanelRef();
        onReferenceChanged();
        panel.refresh();
      });
    }
  };

  editKeyPress = (event: any) => {
    if ('Enter' === event.key) {
      this.loadDashboard();
    }
  };

  updatePath = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const path = event.currentTarget.value;
    this.setState({ path });
  };

  render() {
    return (
      <div className="panel-options-group">
        <div className="panel-options-group__header">Reference Panel</div>
        <div className="panel-options-group__body">
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel width={5}>Panel</FormLabel>
            </div>
            <div className="gf-form">
              <input
                type="text"
                placeholder="Enter Panel URL"
                className={`gf-form-input width-15`}
                value={this.state.path}
                onChange={this.updatePath}
                onKeyPress={this.editKeyPress}
              />
            </div>
            <button onClick={this.loadDashboard} className="gf-form-label gf-form-label--btn">
              Load <i className="fa fa-save" />
            </button>
          </div>

          <div className="gf-form-hint">
            <div className="muted">Enter the dashboard ID or the URL showing a panel</div>
          </div>
        </div>
      </div>
    );
  }
}
