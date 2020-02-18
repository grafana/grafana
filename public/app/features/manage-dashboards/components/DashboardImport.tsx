import React, { FormEvent, PureComponent } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { NavModel } from '@grafana/data';
import { Forms, stylesFactory } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import ImportDashboardForm from './ImportDashboardForm';
import { fetchGcomDashboard } from '../state/actions';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

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

    if (dashboardId) {
      this.props.fetchGcomDashboard(dashboardId);
    }
  };

  renderImportForm() {
    const styles = importStyles();

    return (
      <>
        <div className={styles.option}>
          <Forms.Legend>Import via .json file</Forms.Legend>
          <Forms.Button>Upload .json file</Forms.Button>
        </div>
        <div className={styles.option}>
          <Forms.Legend>Import via grafana.com</Forms.Legend>
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
          <Forms.Legend>Import via panel json</Forms.Legend>
          <Forms.Field>
            <Forms.TextArea rows={10} />
          </Forms.Field>
          <Forms.Button>Load</Forms.Button>
        </div>
      </>
    );
  }

  render() {
    const { dashboard, navModel } = this.props;
    return (
      <Page navModel={navModel}>
        <Page.Contents>{dashboard.json ? <ImportDashboardForm /> : this.renderImportForm()}</Page.Contents>
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
