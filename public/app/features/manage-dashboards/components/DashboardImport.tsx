import React, { FormEvent, PureComponent } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { NavModel } from '@grafana/data';
import { Forms, stylesFactory } from '@grafana/ui';
import Page from '../../../core/components/Page/Page';
import { fetchGcomDashboard } from '../state/actions';
import { getNavModel } from '../../../core/selectors/navModel';
import { StoreState } from '../../../types';

interface Props {
  navModel: NavModel;
  dashboard: any;

  fetchGcomDashboard: typeof fetchGcomDashboard;
}

interface State {
  gcomDashboard: string;
  dashboardJson: string;
  dashboardFile: any;
  gcomError: string;
}

const importStyles = stylesFactory(() => {
  return {
    option: css`
      margin-bottom: 32px;
    `,
  };
});

class DashboardImport extends PureComponent<Props, State> {
  static state = {
    gcomDashboard: '',
    dashboardJson: '',
    dashboardFile: '',
  };

  onGcomDashboardChange = (event: FormEvent<HTMLInputElement>) => {
    this.setState({ gcomDashboard: event.currentTarget.value });
  };

  getGcomDashboard = () => {
    const { gcomDashboard } = this.state;

    // From DashboardImportCtrl
    const match = /(^\d+$)|dashboards\/(\d+)/.exec(gcomDashboard);
    let dashboardId;

    if (match && match[1]) {
      dashboardId = match[1];
    } else if (match && match[2]) {
      dashboardId = match[2];
    } else {
      this.setState({
        gcomError: 'Could not find dashboard',
      });
    }

    this.props.fetchGcomDashboard(dashboardId);
  };

  renderImportForm() {
    const styles = importStyles();

    return (
      <>
        <div className={styles.option}>
          <h3>Import via .json file</h3>
          <Forms.Button>Upload .json file</Forms.Button>
        </div>
        <div className={styles.option}>
          <h3>Import via grafana.com</h3>
          <Forms.Field>
            <Forms.Input
              size="md"
              placeholder="Grafana.com dashboard url or id"
              onChange={this.onGcomDashboardChange}
              addonAfter={<Forms.Button onClick={this.getGcomDashboard}>Load</Forms.Button>}
            />
          </Forms.Field>
        </div>
        <div className={styles.option}>
          <h3>Import via panel json</h3>
          <Forms.Field>
            <Forms.TextArea rows={10} />
          </Forms.Field>
          <Forms.Button>Load</Forms.Button>
        </div>
      </>
    );
  }

  renderSaveForm() {
    const { dashboard } = this.props;
    return (
      <>
        {dashboard.json.gnetId && (
          <div className="gf-form-group">
            <h3 className="section-heading">
              Importing Dashboard from{' '}
              <a
                href={`https://grafana.com/dashboards/${dashboard.json.gnetId}`}
                className="external-link"
                target="_blank"
              >
                Grafana.com
              </a>
            </h3>

            <div className="gf-form">
              <Forms.Label>Published by</Forms.Label>
              <label className="gf-form-label width-15">{dashboard.orgName}</label>
            </div>
            <div className="gf-form">
              <label className="gf-form-label width-15">Updated on</label>
              <label className="gf-form-label width-15">{dashboard.updatedAt}</label>
            </div>
          </div>
        )}
        <h3 className="section-heading">Options</h3>

        <div className="gf-form-group">
          <div className="gf-form-inline">
            <div className="gf-form gf-form--grow">
              <label className="gf-form-label width-15">Name</label>
              <input
                type="text"
                className="gf-form-input"
                ng-model="ctrl.dash.title"
                give-focus="true"
                ng-change="ctrl.titleChanged()"
                ng-class="{'validation-error': ctrl.nameExists || !ctrl.dash.title}"
              />
              <label className="gf-form-label text-success" ng-if="ctrl.titleTouched && !ctrl.hasNameValidationError">
                <i className="fa fa-check" />
              </label>
            </div>
          </div>

          <div className="gf-form-inline" ng-if="ctrl.hasNameValidationError">
            <div className="gf-form offset-width-15 gf-form--grow">
              <label className="gf-form-label text-warning gf-form-label--grow">
                <i className="fa fa-warning" />
              </label>
            </div>
          </div>
        </div>
      </>
    );
  }

  render() {
    const { dashboard, navModel } = this.props;
    return (
      <Page navModel={navModel}>
        <Page.Contents>{dashboard.json ? this.renderSaveForm() : this.renderImportForm()}</Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => {
  return {
    navModel: getNavModel(state.navIndex, 'import', null, true),
    dashboard: state.importDashboard.dashboard,
  };
};

const mapDispatchToProps = {
  fetchGcomDashboard,
};

export default connect(mapStateToProps, mapDispatchToProps)(DashboardImport);
