// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';

// Types
import { PanelModel } from '../state/PanelModel';

import config from 'app/core/config';
import { FormLabel, Select } from '@grafana/ui';
import { validateReference, loadPanelRef, PanelReferenceInfo } from '../state/PanelReference';

interface Props {
  panel: PanelModel;
  onReferenceChanged: () => void;
}

interface State {
  info?: PanelReferenceInfo;
  edit: boolean;
  path: string;
  changed: boolean;
}

export class ReferencedPanelEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      edit: false,
      path: '',
      changed: false,
    };
    this.loadInfo();
  }

  loadInfo() {
    loadPanelRef(this.props.panel.reference).then(info => {
      this.setState({ info });
    });
  }

  removeReference = () => {
    const { panel, onReferenceChanged } = this.props;
    panel.reference = null;
    onReferenceChanged(); // should hide this editor
    panel.refresh();
  };

  getPanelsInDashboard() {
    const { info } = this.state;
    if (!info || !info.dashboard) {
      return null;
    }

    return this.state.info.dashboard.panels
      .filter(panel => !panel.reference)
      .map((panel, idx) => {
        const plugin = config.panels[panel.type];
        return {
          value: panel.id,
          label: panel.title + ' (' + panel.id + ')',
          imgUrl: plugin.info.logos.small,
        };
      });
  }

  onPanelChanged = (id: number) => {
    const { panel, onReferenceChanged } = this.props;
    panel.reference.panelId = id;
    onReferenceChanged(); // should hide this editor
    panel.refresh();
    this.forceUpdate();
  };

  editDashboard = () => {
    const { panel } = this.props;
    this.setState({
      edit: true,
      path: panel.reference.dashboard,
      changed: false,
    });
  };

  cancelEdit = () => {
    this.setState({ edit: false });
  };

  loadDashboard = () => {
    const { path, changed } = this.state;
    if (changed) {
      validateReference(path)
        .then(info => {
          const { panel, onReferenceChanged } = this.props;
          panel.reference = info.toPanelRef();
          this.setState({ edit: false, info });
          onReferenceChanged();
          panel.refresh();
        })
        .catch(err => {
          console.warn('Invalid Path', err);
        });
    } else {
      this.setState({ edit: false });
    }
  };

  editKeyPress = (event: any) => {
    if ('Enter' === event.key) {
      this.loadDashboard();
    }
  };

  updatePath = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const path = event.currentTarget.value;
    this.setState({ path, changed: true });
  };

  render() {
    const { panel } = this.props;
    const { info, edit } = this.state;
    const { reference } = panel;
    const hackStyle = {
      margin: '20px 20px',
    };

    const options = this.getPanelsInDashboard();

    return (
      <div style={hackStyle}>
        <h1>Panel is Copied From:</h1>
        {edit && (
          <div>
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel width={7}>Dashboard</FormLabel>
              </div>
              <div className="gf-form">
                <input
                  type="text"
                  className={`gf-form-input width-15`}
                  autoFocus={true}
                  value={this.state.path}
                  onChange={this.updatePath}
                  onKeyPress={this.editKeyPress}
                />
              </div>
              <button onClick={this.loadDashboard} className="gf-form-label gf-form-label--btn">
                Load <i className="fa fa-save" />
              </button>
              <button onClick={this.cancelEdit} className="gf-form-label gf-form-label--btn">
                Cancel <i className="fa fa-times" />
              </button>
            </div>
            <div>Enter the dashboard ID or the URL showing a panel</div>
          </div>
        )}

        {options && !edit && (
          <div>
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel width={7}>Dashboard</FormLabel>
              </div>
              <button onClick={this.editDashboard} className="gf-form-label gf-form-label--btn">
                {info.dashboard.title} &nbsp; &nbsp;
                <i className="fa fa-edit" />
              </button>
            </div>

            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel width={7}>Panel</FormLabel>
                <Select
                  placeholder="Choose type"
                  isSearchable={true}
                  options={options}
                  value={options.find(o => o.value === reference.panelId)}
                  onChange={type => this.onPanelChanged(type.value)}
                />
                <div className="gf-form">&nbsp;&nbsp;</div>
              </div>
            </div>
          </div>
        )}

        <br />
        <br />

        <div className="gf-form-inline">
          <a
            className="btn btn-primary"
            href={`/d/${reference.dashboard}/?fullscreen&edit&panelId=${reference.panelId}`}
          >
            <i className="fa fa-edit" /> Edit Source Panel
          </a>
          &nbsp;
          <button onClick={this.removeReference} className="btn btn-inverse">
            <i className="fa fa-times" /> Remove Reference
          </button>
        </div>
      </div>
    );
  }
}
