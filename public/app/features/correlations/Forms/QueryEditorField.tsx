import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { useAsync } from 'react-use';

import { getDataSourceSrv } from '@grafana/runtime';
import { Field, LoadingPlaceholder, Alert, Button, HorizontalGroup, Icon, useTheme2 } from '@grafana/ui';

interface Props {
  dsUid?: string;
  name: string;
  invalid?: boolean;
  error?: string;
}

export const QueryEditorField = ({ dsUid, invalid, error, name }: Props) => {
  const [isValidQuery, setIsValidQuery] = useState(false);
  const theme = useTheme2();

  const styles = useMemo(() => {
    return {
      error: css`
        color: ${theme.colors.error.text};
      `,
      valid: css`
        color: ${theme.colors.success.text};
      `,
    };
  }, [theme]);

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

  const handleValidation = () => {
    // trigger query
    // filter result as we only need to know whether it was successful or not
    // if it was successful change state for isValidQuery to true
    setIsValidQuery(true);
  };

  return (
    <Field label="Query" invalid={invalid} error={error}>
      <Controller
        name={name}
        rules={{
          validate: {
            hasQueryEditor: () =>
              QueryEditor !== undefined || 'The selected target data source must export a query editor.',
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
          if (!QueryEditor) {
            return <Alert title="Data source does not export a query editor."></Alert>;
          }

          return (
            <>
              <QueryEditor
                onRunQuery={datasource.type === 'loki' || 'prometheus' ? handleValidation : () => {}}
                onChange={onChange}
                datasource={datasource}
                query={value}
              />
              <HorizontalGroup justify="flex-end">
                {isValidQuery ? (
                  <div className={styles.valid}>
                    <Icon name="check" /> This query is valid.
                  </div>
                ) : (
                  <div className={styles.error}>
                    <Icon name="exclamation-triangle" /> This query is not valid.
                  </div>
                )}
                <Button variant="primary" icon={'check'} type="button" onClick={handleValidation}>
                  Validate query
                </Button>
              </HorizontalGroup>
            </>
          );
        }}
      />
    </Field>
  );
};
