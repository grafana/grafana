import React, { FormEvent, PureComponent } from 'react';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { NavModel } from '@grafana/data';
import { Forms, stylesFactory } from '@grafana/ui';
import Page from '../../../core/components/Page/Page';
import { getGcomDashboard } from '../state/actions';
import { getNavModel } from '../../../core/selectors/navModel';
import { StoreState } from '../../../types';

interface Props {
  navModel: NavModel;

  getGcomDashboard: typeof getGcomDashboard;
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

    this.props.getGcomDashboard(dashboardId);
  };

  render() {
    const { navModel } = this.props;
    const styles = importStyles();

    return (
      <Page navModel={navModel}>
        <Page.Contents>
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
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => {
  return {
    navModel: getNavModel(state.navIndex, 'import', null, true),
  };
};

const mapDispatchToProps = () => ({
  getGcomDashboard,
});

export default connect(mapStateToProps, mapDispatchToProps)(DashboardImport);
