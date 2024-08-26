import { Controller } from 'react-hook-form';
import { useAsync } from 'react-use';

import { CoreApp } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Field, LoadingPlaceholder, Alert } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { CORR_TYPES } from '../types';

interface Props {
  dsUid?: string;
  name: string;
  invalid?: boolean;
  error?: string;
}

export const QueryEditorField = ({ dsUid, invalid, error, name }: Props) => {
  const {
    value: datasource,
    loading: dsLoading,
    error: dsError,
  } = useAsync(async () => {
    if (!dsUid) {
      return;
    }
    return getDataSourceSrv().get(dsUid);
  }, [dsUid]);

  const QueryEditor = datasource?.components?.QueryEditor;

  return (
    <Field
      label={t('correlations.query-editor.query-label', 'Query')}
      description={
        <span>
          <Trans i18nKey="correlations.query-editor.query-description">
            Define the query that is run when the link is clicked. You can use{' '}
            <a
              href="https://grafana.com/docs/grafana/latest/panels-visualizations/configure-data-links/"
              target="_blank"
              rel="noreferrer"
            >
              variables
            </a>{' '}
            to access specific field values.
          </Trans>
        </span>
      }
      invalid={invalid}
      error={error}
    >
      <Controller
        name={name}
        rules={{
          validate: {
            hasQueryEditor: (_, formVals) => {
              return formVals.type === CORR_TYPES.query.value && QueryEditor === undefined
                ? t(
                    'correlations.query-editor.control-rules',
                    'The selected target data source must export a query editor.'
                  )
                : true;
            },
          },
        }}
        render={({ field: { value, onChange } }) => {
          if (dsLoading) {
            return <LoadingPlaceholder text={t('correlations.query-editor.loading', 'Loading query editor...')} />;
          }
          if (dsError) {
            return (
              <Alert title={t('correlations.query-editor.error-title', 'Error loading data source')}>
                <Trans i18nKey="correlations.query-editor.error-text">
                  The selected data source could not be loaded.
                </Trans>
              </Alert>
            );
          }
          if (!datasource) {
            return (
              <Alert
                title={t('correlations.query-editor.data-source-title', 'No data source selected')}
                severity="info"
              >
                <Trans i18nKey="correlations.query-editor.data-source-text">
                  Please select a target data source first.
                </Trans>
              </Alert>
            );
          }
          if (!QueryEditor) {
            return (
              <Alert
                title={t('correlations.query-editor.query-editor-title', 'Data source does not export a query editor.')}
              ></Alert>
            );
          }
          return (
            <>
              <QueryEditor
                onRunQuery={() => {}}
                app={CoreApp.Correlations}
                onChange={(value) => {
                  onChange(value);
                }}
                datasource={datasource}
                query={value}
              />
            </>
          );
        }}
      />
    </Field>
  );
};
