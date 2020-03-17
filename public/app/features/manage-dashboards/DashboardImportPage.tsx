import React, { FormEvent, PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { css } from 'emotion';
import { AppEvents, NavModel } from '@grafana/data';
import { Forms, stylesFactory } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { ImportDashboardOverview } from './components/ImportDashboardOverview';
import { DashboardFileUpload } from './components/DashboardFileUpload';
import { fetchGcomDashboard, importDashboardJson } from './state/actions';
import appEvents from 'app/core/app_events';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

interface OwnProps {}

interface ConnectedProps {
  navModel: NavModel;
  isLoaded: boolean;
}

interface DispatchProps {
  fetchGcomDashboard: typeof fetchGcomDashboard;
  importDashboardJson: typeof importDashboardJson;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

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

class DashboardImportUnConnected extends PureComponent<Props, State> {
  state: State = {
    gcomDashboard: '',
    dashboardJson: '',
    dashboardFile: '',
    gcomError: '',
  };

  onGcomDashboardChange = (event: FormEvent<HTMLInputElement>) => {
    this.setState({ gcomDashboard: event.currentTarget.value });
  };

  onDashboardJsonChange = (event: FormEvent<HTMLTextAreaElement>) => {
    this.setState({ dashboardJson: event.currentTarget.value });
  };

  onFileUpload = (event: FormEvent<HTMLInputElement>) => {
    const { importDashboardJson } = this.props;
    const file = event.currentTarget.files[0];

    const reader = new FileReader();
    const readerOnLoad = () => {
      return (e: any) => {
        let dashboard: any;
        try {
          dashboard = JSON.parse(e.target.result);
        } catch (error) {
          console.log(error);
          appEvents.emit(AppEvents.alertError, ['Import failed', 'JSON -> JS Serialization failed: ' + error.message]);
          return;
        }
        importDashboardJson(dashboard);
      };
    };
    reader.onload = readerOnLoad();
    reader.readAsText(file);
  };

  onDashboardJsonLoad = () => {
    const { dashboardJson } = this.state;
    const { importDashboardJson } = this.props;

    if (!dashboardJson) {
      return;
    }
    let dashboard: any;
    try {
      dashboard = JSON.parse(dashboardJson);
      importDashboardJson(dashboard);
    } catch (error) {
      appEvents.emit(AppEvents.alertError, ['Import failed', 'JSON -> JS Serialization failed: ' + error.message]);
      return;
    }
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
    const { gcomDashboard, dashboardJson } = this.state;
    const styles = importStyles();

    return (
      <>
        <div className={styles.option}>
          <DashboardFileUpload onFileUpload={this.onFileUpload} />
        </div>
        <div className={styles.option}>
          <Forms.Legend>Import via grafana.com</Forms.Legend>
          <Forms.Field>
            <Forms.Input
              size="md"
              placeholder="Grafana.com dashboard url or id"
              onChange={this.onGcomDashboardChange}
              addonAfter={
                <Forms.Button disabled={gcomDashboard === ''} onClick={this.getGcomDashboard}>
                  Load
                </Forms.Button>
              }
            />
          </Forms.Field>
        </div>
        <div className={styles.option}>
          <Forms.Legend>Import via panel json</Forms.Legend>
          <Forms.Field>
            <Forms.TextArea rows={10} onChange={this.onDashboardJsonChange} />
          </Forms.Field>
          <Forms.Button disabled={dashboardJson === ''} onClick={this.onDashboardJsonLoad}>
            Load
          </Forms.Button>
        </div>
      </>
    );
  }

  render() {
    const { isLoaded, navModel } = this.props;
    return (
      <Page navModel={navModel}>
        <Page.Contents>{isLoaded ? <ImportDashboardOverview /> : this.renderImportForm()}</Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'import', null, true),
  isLoaded: state.importDashboard.isLoaded,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, Props> = {
  fetchGcomDashboard,
  importDashboardJson,
};

export const DashboardImportPage = connect(mapStateToProps, mapDispatchToProps)(DashboardImportUnConnected);
export default DashboardImportPage;
DashboardImportPage.displayName = 'DashboardImport';
