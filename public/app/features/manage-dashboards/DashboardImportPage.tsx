import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { AppEvents, GrafanaTheme2, LoadingState, NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, reportInteraction } from '@grafana/runtime';
import {
  Button,
  Field,
  Form,
  HorizontalGroup,
  Input,
  Spinner,
  stylesFactory,
  TextArea,
  Themeable2,
  VerticalGroup,
  FileDropzone,
  withTheme2,
  DropzoneFile,
  FileDropzoneDefaultChildren,
  LinkButton,
} from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { StoreState } from 'app/types';

import { cleanUpAction } from '../../core/actions/cleanUp';

import { ImportDashboardOverview } from './components/ImportDashboardOverview';
import { fetchGcomDashboard, importDashboardJson } from './state/actions';
import { initialImportDashboardState } from './state/reducers';
import { validateDashboardJson, validateGcomDashboard } from './utils/validation';

type DashboardImportPageRouteSearchParams = {
  gcomDashboardId?: string;
};

type OwnProps = Themeable2 & GrafanaRouteComponentProps<{}, DashboardImportPageRouteSearchParams>;

const IMPORT_STARTED_EVENT_NAME = 'dashboard_import_loaded';

const mapStateToProps = (state: StoreState) => ({
  loadingState: state.importDashboard.state,
});

const mapDispatchToProps = {
  fetchGcomDashboard,
  importDashboardJson,
  cleanUpAction,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = OwnProps & ConnectedProps<typeof connector>;

class UnthemedDashboardImport extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
    const { gcomDashboardId } = this.props.queryParams;
    if (gcomDashboardId) {
      this.getGcomDashboard({ gcomDashboard: gcomDashboardId });
      return;
    }
  }

  componentWillUnmount() {
    this.props.cleanUpAction({ cleanupAction: (state) => (state.importDashboard = initialImportDashboardState) });
  }

  // Do not display upload file list
  fileListRenderer = (file: DropzoneFile, removeFile: (file: DropzoneFile) => void) => null;

  onFileUpload = (result: string | ArrayBuffer | null) => {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, {
      import_source: 'json_uploaded',
    });

    try {
      this.props.importDashboardJson(JSON.parse(String(result)));
    } catch (error) {
      if (error instanceof Error) {
        appEvents.emit(AppEvents.alertError, ['Import failed', 'JSON -> JS Serialization failed: ' + error.message]);
      }
      return;
    }
  };

  getDashboardFromJson = (formData: { dashboardJson: string }) => {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, {
      import_source: 'json_pasted',
    });

    this.props.importDashboardJson(JSON.parse(formData.dashboardJson));
  };

  getGcomDashboard = (formData: { gcomDashboard: string }) => {
    reportInteraction(IMPORT_STARTED_EVENT_NAME, {
      import_source: 'gcom',
    });

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
          <FileDropzone
            options={{ multiple: false, accept: ['.json', '.txt'] }}
            readAs="readAsText"
            fileListRenderer={this.fileListRenderer}
            onLoad={this.onFileUpload}
          >
            <FileDropzoneDefaultChildren
              primaryText="Upload dashboard JSON file"
              secondaryText="Drag and drop here or click to browse"
            />
          </FileDropzone>
        </div>
        <div className={styles.option}>
          <Form onSubmit={this.getGcomDashboard} defaultValues={{ gcomDashboard: '' }}>
            {({ register, errors }) => (
              <Field
                label="Import via grafana.com"
                invalid={!!errors.gcomDashboard}
                error={errors.gcomDashboard && errors.gcomDashboard.message}
              >
                <Input
                  id="url-input"
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
          <Form onSubmit={this.getDashboardFromJson} defaultValues={{ dashboardJson: '' }}>
            {({ register, errors }) => (
              <>
                <Field
                  label="Import via panel json"
                  invalid={!!errors.dashboardJson}
                  error={errors.dashboardJson && errors.dashboardJson.message}
                >
                  <TextArea
                    {...register('dashboardJson', {
                      required: 'Need a dashboard JSON model',
                      validate: validateDashboardJson,
                    })}
                    data-testid={selectors.components.DashboardImportPage.textarea}
                    id="dashboard-json-textarea"
                    rows={10}
                  />
                </Field>
                <HorizontalGroup>
                  <Button type="submit" data-testid={selectors.components.DashboardImportPage.submit}>
                    Load
                  </Button>
                  <LinkButton variant="secondary" href={`${config.appSubUrl}/dashboards`}>
                    Cancel
                  </LinkButton>
                </HorizontalGroup>
              </>
            )}
          </Form>
        </div>
      </>
    );
  }

  pageNav: NavModelItem = {
    text: 'Import dashboard',
    subTitle: 'Import dashboard from file or Grafana.com',
    breadcrumbs: [{ title: 'Dashboards', url: 'dashboards' }],
  };

  render() {
    const { loadingState } = this.props;

    return (
      <Page navId="dashboards/browse" pageNav={this.pageNav}>
        <Page.Contents>
          {loadingState === LoadingState.Loading && (
            <VerticalGroup justify="center">
              <HorizontalGroup justify="center">
                <Spinner size={32} />
              </HorizontalGroup>
            </VerticalGroup>
          )}
          {[LoadingState.Error, LoadingState.NotStarted].includes(loadingState) && this.renderImportForm()}
          {loadingState === LoadingState.Done && <ImportDashboardOverview />}
        </Page.Contents>
      </Page>
    );
  }
}

const DashboardImportUnConnected = withTheme2(UnthemedDashboardImport);
const DashboardImport = connector(DashboardImportUnConnected);
DashboardImport.displayName = 'DashboardImport';
export default DashboardImport;

const importStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    option: css`
      margin-bottom: ${theme.spacing(4)};
      max-width: 600px;
    `,
  };
});
