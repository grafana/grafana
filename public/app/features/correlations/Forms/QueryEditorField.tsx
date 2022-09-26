import React from 'react';
import { Controller } from 'react-hook-form';
import { useAsync } from 'react-use';

import { getDataSourceSrv } from '@grafana/runtime';
import { Field, LoadingPlaceholder, Alert } from '@grafana/ui';

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
  const QuerEditor = datasource?.components?.QueryEditor;

  return (
    <Field label="Query" invalid={invalid} error={error}>
      <Controller
        name={name}
        // FIXME: this won't be needed when the API will return the default config
        defaultValue={{}}
        rules={{
          validate: {
            hasQueryEditor: () =>
              QuerEditor !== undefined || 'The selected target data source must export a query editor.',
          },
        }}
        render={({ field: { value, onChange } }) => {
          if (dsLoading) {
            return <LoadingPlaceholder text="Loading query editor..." />;
          }
          if (dsError) {
            return <Alert title="Error loading data source">The selected data source could not be loaded.</Alert>;
          }
          if (!datasource) {
            return (
              <Alert title="No data source selected" severity="info">
                Please select a target data source first.
              </Alert>
            );
          }
          if (!QuerEditor) {
            return <Alert title="Data source does not export a query editor."></Alert>;
          }

          return <QuerEditor onRunQuery={() => {}} onChange={onChange} datasource={datasource} query={value} />;
        }}
      />
    </Field>
  );
};
