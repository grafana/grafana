// Libaries
import React, { PureComponent } from 'react';

// Utils & Services
import { AngularComponent, getAngularLoader } from '@grafana/runtime';

// Types
import { DashboardModel } from '../../state/DashboardModel';
import { BackButton } from 'app/core/components/BackButton/BackButton';
import { e2e } from '@grafana/e2e';
import { updateLocation } from 'app/core/actions';

export interface Props {
  dashboard: DashboardModel | null;
  updateLocation: typeof updateLocation;
}

export class DashboardSettings extends PureComponent<Props> {
  element: HTMLElement;
  angularCmp: AngularComponent;

  componentDidMount() {
    const loader = getAngularLoader();

    const template = '<dashboard-settings dashboard="dashboard" class="dashboard-settings__body2" />';
    const scopeProps = { dashboard: this.props.dashboard };

    this.angularCmp = loader.load(this.element, scopeProps, template);
  }

  componentWillUnmount() {
    if (this.angularCmp) {
      this.angularCmp.destroy();
    }
  }

  onClose = () => {
    this.props.updateLocation({
      query: { editview: null },
      partial: true,
    });
  };

  render() {
    const { dashboard } = this.props;
    const folderTitle = dashboard.meta.folderTitle;
    const haveFolder = dashboard.meta.folderId > 0;

    return (
      <div className="dashboard-settings">
        <div className="navbar navbar--shadow">
          <div className="navbar-edit">
            <BackButton onClick={this.onClose} aria-label={e2e.pages.Dashboard.Toolbar.selectors.backArrow} />
          </div>
          <div className="navbar-page-btn">
            {haveFolder && <div className="navbar-page-btn__folder">{folderTitle} / </div>}
            <span>{dashboard.title} / Settings</span>
          </div>
        </div>
        <div className="dashboard-settings__body1" ref={element => (this.element = element)} />
      </div>
    );
  }
}
