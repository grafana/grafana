import { css } from '@emotion/css';
import { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { AppEvents, GrafanaTheme2, LoadingState, NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, reportInteraction } from '@grafana/runtime';
import {
  Button,
  Field,
  Input,
  Spinner,
  stylesFactory,
  TextArea,
  Themeable2,
  FileDropzone,
  withTheme2,
  DropzoneFile,
  FileDropzoneDefaultChildren,
  LinkButton,
  TextLink,
  Label,
  Stack,
} from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Form } from 'app/core/components/Form/Form';
import { Page } from 'app/core/components/Page/Page';
import { t, Trans } from 'app/core/internationalization';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { dispatch } from 'app/store/store';
import { StoreState } from 'app/types';

import { cleanUpAction } from '../../core/actions/cleanUp';
import { ImportDashboardOverviewV2 } from '../dashboard-scene/v2schema/ImportDashboardOverviewV2';

import { ImportDashboardOverview } from './components/ImportDashboardOverview';
import { fetchGcomDashboard, importDashboardJson, importDashboardV2Json } from './state/actions';
import { initialImportDashboardState } from './state/reducers';
import { validateDashboardJson, validateGcomDashboard } from './utils/validation';

type DashboardImportPageRouteSearchParams = {
  gcomDashboardId?: string;
};

type OwnProps = Themeable2 & GrafanaRouteComponentProps<{}, DashboardImportPageRouteSearchParams>;

const IMPORT_STARTED_EVENT_NAME = 'dashboard_import_loaded';
const JSON_PLACEHOLDER = `{
    "title": "Example - Repeating Dictionary variables",
    "uid": "_0HnEoN4z",
    "panels": [...]
    ...
}
`;

const mapStateToProps = (state: StoreState) => ({
  loadingState: state.importDashboard.state,
  dashboard: state.importDashboard.dashboard,
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
      const json = JSON.parse(String(result));

      if (json.elements) {
        dispatch(importDashboardV2Json(json));
        return;
      }
      this.props.importDashboardJson(json);
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

    const dashboard = JSON.parse(formData.dashboardJson);

    if (dashboard.elements) {
      dispatch(importDashboardV2Json(dashboard));
      return;
    }

    this.props.importDashboardJson(dashboard);
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

    const GcomDashboardsLink = () => (
      // eslint-disable-next-line @grafana/no-untranslated-strings
      <TextLink variant="bodySmall" href="https://grafana.com/grafana/dashboards/" external>
        grafana.com/dashboards
      </TextLink>
    );

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
              primaryText={t('dashboard-import.file-dropzone.primary-text', 'Upload dashboard JSON file')}
              secondaryText={t(
                'dashboard-import.file-dropzone.secondary-text',
                'Drag and drop here or click to browse'
              )}
            />
          </FileDropzone>
        </div>
        <div className={styles.option}>
          <Form onSubmit={this.getGcomDashboard} defaultValues={{ gcomDashboard: '' }}>
            {({ register, errors }) => (
              <Field
                label={
                  <Label className={styles.labelWithLink} htmlFor="url-input">
                    <span>
                      <Trans i18nKey="dashboard-import.gcom-field.label">
                        Find and import dashboards for common applications at <GcomDashboardsLink />
                      </Trans>
                    </span>
                  </Label>
                }
                invalid={!!errors.gcomDashboard}
                error={errors.gcomDashboard && errors.gcomDashboard.message}
              >
                <Input
                  id="url-input"
                  placeholder={t('dashboard-import.gcom-field.placeholder', 'Grafana.com dashboard URL or ID')}
                  type="text"
                  {...register('gcomDashboard', {
                    required: t(
                      'dashboard-import.gcom-field.validation-required',
                      'A Grafana dashboard URL or ID is required'
                    ),
                    validate: validateGcomDashboard,
                  })}
                  addonAfter={
                    <Button type="submit">
                      <Trans i18nKey="dashboard-import.gcom-field.load-button">Load</Trans>
                    </Button>
                  }
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
                  label={t('dashboard-import.json-field.label', 'Import via dashboard JSON model')}
                  invalid={!!errors.dashboardJson}
                  error={errors.dashboardJson && errors.dashboardJson.message}
                >
                  <TextArea
                    {...register('dashboardJson', {
                      required: t('dashboard-import.json-field.validation-required', 'Need a dashboard JSON model'),
                      validate: validateDashboardJson,
                    })}
                    data-testid={selectors.components.DashboardImportPage.textarea}
                    id="dashboard-json-textarea"
                    rows={10}
                    placeholder={JSON_PLACEHOLDER}
                  />
                </Field>
                <Stack>
                  <Button type="submit" data-testid={selectors.components.DashboardImportPage.submit}>
                    <Trans i18nKey="dashboard-import.form-actions.load">Load</Trans>
                  </Button>
                  <LinkButton variant="secondary" href={`${config.appSubUrl}/dashboards`}>
                    <Trans i18nKey="dashboard-import.form-actions.cancel">Cancel</Trans>
                  </LinkButton>
                </Stack>
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
  };

  getDashboardOverview() {
    const { loadingState, dashboard } = this.props;

    if (loadingState === LoadingState.Done) {
      if (dashboard.elements) {
        return <ImportDashboardOverviewV2 />;
      }
      return <ImportDashboardOverview />;
    }

    return null;
  }

  render() {
    const { loadingState } = this.props;

    return (
      <Page navId="dashboards/browse" pageNav={this.pageNav}>
        <Page.Contents>
          {loadingState === LoadingState.Loading && (
            <Stack direction={'column'} justifyContent="center">
              <Stack justifyContent="center">
                <Spinner size="xxl" />
              </Stack>
            </Stack>
          )}
          {[LoadingState.Error, LoadingState.NotStarted].includes(loadingState) && this.renderImportForm()}
          {this.getDashboardOverview()}
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
    option: css({
      marginBottom: theme.spacing(4),
      maxWidth: '600px',
    }),
    labelWithLink: css({
      maxWidth: '100%',
    }),
    linkWithinLabel: css({
      fontSize: 'inherit',
    }),
  };
});
