import React, { FormEvent, PureComponent } from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { css } from '@emotion/css';
import { AppEvents, GrafanaTheme2, NavModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  Button,
  stylesFactory,
  withTheme2,
  Input,
  TextArea,
  Field,
  Form,
  Legend,
  FileUpload,
  Themeable2,
} from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { connectWithCleanUp } from 'app/core/components/connectWithCleanUp';
import { ImportDashboardOverview } from './components/ImportDashboardOverview';
import { validateDashboardJson, validateGcomDashboard } from './utils/validation';
import { fetchGcomDashboard, importDashboardJson } from './state/actions';
import appEvents from 'app/core/app_events';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

interface OwnProps extends Themeable2 {}

interface ConnectedProps {
  navModel: NavModel;
  isLoaded: boolean;
}

interface DispatchProps {
  fetchGcomDashboard: typeof fetchGcomDashboard;
  importDashboardJson: typeof importDashboardJson;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

class UnthemedDashboardImport extends PureComponent<Props> {
  onFileUpload = (event: FormEvent<HTMLInputElement>) => {
    const { importDashboardJson } = this.props;
    const file = event.currentTarget.files && event.currentTarget.files.length > 0 && event.currentTarget.files[0];

    if (file) {
      const reader = new FileReader();
      const readerOnLoad = () => {
        return (e: any) => {
          let dashboard: any;
          try {
            dashboard = JSON.parse(e.target.result);
          } catch (error) {
            appEvents.emit(AppEvents.alertError, [
              'Import failed',
              'JSON -> JS Serialization failed: ' + error.message,
            ]);
            return;
          }
          importDashboardJson(dashboard);
        };
      };
      reader.onload = readerOnLoad();
      reader.readAsText(file);
    }
  };

  getDashboardFromJson = (formData: { dashboardJson: string }) => {
    this.props.importDashboardJson(JSON.parse(formData.dashboardJson));
  };

  getGcomDashboard = (formData: { gcomDashboard: string }) => {
    let dashboardId;
    const match = /(^\d+$)|dashboards\/(\d+)/.exec(formData.gcomDashboard);
    if (match && match[1]) {
      dashboardId = match[1];
    } else if (match && match[2]) {
      dashboardId = match[2];
    }

    if (dashboardId) {
      this.props.fetchGcomDashboard(dashboardId);
    }
  };

  renderImportForm() {
    const styles = importStyles(this.props.theme);

    return (
      <>
        <div className={styles.option}>
          <FileUpload accept="application/json" onFileUpload={this.onFileUpload}>
            Upload JSON file
          </FileUpload>
        </div>
        <div className={styles.option}>
          <Legend>Import via grafana.com</Legend>
          <Form onSubmit={this.getGcomDashboard} defaultValues={{ gcomDashboard: '' }}>
            {({ register, errors }) => (
              <Field invalid={!!errors.gcomDashboard} error={errors.gcomDashboard && errors.gcomDashboard.message}>
                <Input
                  placeholder="Grafana.com dashboard URL or ID"
                  type="text"
                  {...register('gcomDashboard', {
                    required: 'A Grafana dashboard URL or ID is required',
                    validate: validateGcomDashboard,
                  })}
                  addonAfter={<Button type="submit">Load</Button>}
                />
              </Field>
            )}
          </Form>
        </div>
        <div className={styles.option}>
          <Legend>Import via panel json</Legend>
          <Form onSubmit={this.getDashboardFromJson} defaultValues={{ dashboardJson: '' }}>
            {({ register, errors }) => (
              <>
                <Field invalid={!!errors.dashboardJson} error={errors.dashboardJson && errors.dashboardJson.message}>
                  <TextArea
                    {...register('dashboardJson', {
                      required: 'Need a dashboard JSON model',
                      validate: validateDashboardJson,
                    })}
                    data-testid={selectors.components.DashboardImportPage.textarea}
                    rows={10}
                  />
                </Field>
                <Button type="submit" data-testid={selectors.components.DashboardImportPage.submit}>
                  Load
                </Button>
              </>
            )}
          </Form>
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

const DashboardImportUnConnected = withTheme2(UnthemedDashboardImport);

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'import', undefined, true),
  isLoaded: state.importDashboard.isLoaded,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, Props> = {
  fetchGcomDashboard,
  importDashboardJson,
};

export const DashboardImportPage = connectWithCleanUp(
  mapStateToProps,
  mapDispatchToProps,
  (state) => state.importDashboard
)(DashboardImportUnConnected);

export default DashboardImportPage;

DashboardImportPage.displayName = 'DashboardImport';

const importStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    option: css`
      margin-bottom: ${theme.spacing(4)};
    `,
  };
});
