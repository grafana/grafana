import { css } from '@emotion/css';
import { noop } from 'lodash';
import { useCallback } from 'react';
import { useAsync } from 'react-use';

import { CoreApp, DataSourcePluginContextProvider, type GrafanaTheme2, LoadingState } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { type PromQuery } from '@grafana/prometheus';
import { getDataSourceInstance, useDataSourceInstanceSettings } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { Alert, Button, useStyles2 } from '@grafana/ui';

import { type LokiQuery } from '../../../../loki-helpers/types';
import { isSupportedExternalRulesSourceType } from '../../utils/datasource';

import { CloudAlertPreview } from './CloudAlertPreview';
import { usePreview } from './PreviewRule';

export interface ExpressionEditorProps {
  value?: string;
  onChange: (value: string) => void;
  dataSourceUid: string; // will be a prometheus or loki datasource
  showPreviewAlertsButton: boolean;
}

export const ExpressionEditor = ({
  value,
  onChange,
  dataSourceUid,
  showPreviewAlertsButton = true,
}: ExpressionEditorProps) => {
  const styles = useStyles2(getStyles);

  const {
    settings: dsi,
    isLoading: settingsLoading,
    error: settingsError,
  } = useDataSourceInstanceSettings(dataSourceUid);

  const dataQuery = mapToQuery(value);
  let dataSourceSettingsError = settingsError;
  if (!settingsLoading && !dataSourceSettingsError) {
    if (!dsi) {
      dataSourceSettingsError = new Error(`Datasource ${dataSourceUid} not found`);
    } else if (!isSupportedExternalRulesSourceType(dsi.type)) {
      dataSourceSettingsError = new Error(`${dsi.type} is not supported as an expression editor`);
    }
  }

  const {
    error,
    loading,
    value: dataSource,
  } = useAsync(() => {
    return getDataSourceInstance(dataSourceUid);
  }, [dataSourceUid]);

  const onChangeQuery = useCallback(
    (query: DataQuery) => {
      onChange(mapToValue(query));
    },
    [onChange]
  );

  const [alertPreview, onPreview] = usePreview();

  const onRunQueriesClick = async () => {
    onPreview();
  };

  if (loading || settingsLoading || dataSource?.uid !== dataSourceUid) {
    return null;
  }

  if (error || dataSourceSettingsError || !dataSource || !dataSource?.components?.QueryEditor || !dsi) {
    const errorMessage =
      error?.message ||
      dataSourceSettingsError?.message ||
      t(
        'alerting.expression-editor.error-no-component',
        'Data source plugin does not export any Query Editor component'
      );
    return (
      <div>
        <Trans i18nKey="alerting.expression-editor.could-not-load-editor">
          Could not load query editor due to: {{ errorMessage }}
        </Trans>
      </div>
    );
  }

  const previewLoaded = alertPreview?.data.state === LoadingState.Done;

  const QueryEditor = dataSource?.components?.QueryEditor;

  // The Preview endpoint returns the preview as a single-element array of data frames
  const previewDataFrame = alertPreview?.data?.series?.find((s) => s.name === 'evaluation results');
  // The preview API returns arrays with empty elements when there are no firing alerts
  const previewHasAlerts = previewDataFrame && previewDataFrame.fields.some((field) => field.values.length > 0);

  return (
    <>
      <DataSourcePluginContextProvider instanceSettings={dsi}>
        <QueryEditor
          query={dataQuery}
          queries={[dataQuery]}
          app={CoreApp.CloudAlerting}
          onChange={onChangeQuery}
          onRunQuery={noop}
          datasource={dataSource}
        />
      </DataSourcePluginContextProvider>
      {showPreviewAlertsButton && (
        <div className={styles.preview}>
          <Button
            type="button"
            onClick={onRunQueriesClick}
            disabled={alertPreview?.data.state === LoadingState.Loading}
          >
            <Trans i18nKey="alerting.expression-editor.preview-alerts">Preview alerts</Trans>
          </Button>
          {previewLoaded && !previewHasAlerts && (
            <Alert
              title={t('alerting.expression-editor.title-alerts-preview', 'Alerts preview')}
              severity="info"
              className={styles.previewAlert}
            >
              <Trans i18nKey="alerting.expression-editor.there-firing-alerts-query">
                There are no firing alerts for your query.
              </Trans>
            </Alert>
          )}
          {previewHasAlerts && <CloudAlertPreview preview={previewDataFrame} />}
        </div>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  preview: css({
    padding: theme.spacing(2, 0),
    maxWidth: `${theme.breakpoints.values.xl}px`,
  }),
  previewAlert: css({
    margin: theme.spacing(1, 0),
  }),
});

function mapToValue(query: DataQuery): string {
  return (query as PromQuery | LokiQuery).expr;
}

function mapToQuery(value: string | undefined) {
  return { refId: 'A', hide: false, expr: value };
}
