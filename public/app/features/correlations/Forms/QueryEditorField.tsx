import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { useAsync } from 'react-use';

import { DataQuery, getDefaultTimeRange } from '@grafana/data';
import { createQueryRunner, getDataSourceSrv } from '@grafana/runtime';
import {
  Field,
  LoadingPlaceholder,
  Alert,
  Button,
  HorizontalGroup,
  Icon,
  useTheme2,
  FieldValidationMessage,
} from '@grafana/ui';

interface Props {
  dsUid?: string;
  name: string;
  invalid?: boolean;
  error?: string;
}

export const QueryEditorField = ({ dsUid, invalid, error, name }: Props) => {
  const [isValidQuery, setIsValidQuery] = useState<boolean | undefined>(undefined);
  const theme = useTheme2();

  const runner = useMemo(() => createQueryRunner(), []);

  const styles = useMemo(() => {
    return {
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

  const handleValidation = async (value: DataQuery) => {
    if (datasource) {
      runner.run({
        datasource: datasource,
        queries: [value],
        timezone: 'utc',
        timeRange: getDefaultTimeRange(),
        maxDataPoints: 100,
        minInterval: null,
      });

      await runner.get().subscribe((panelData) => {
        if (panelData.state === 'Done') {
          setIsValidQuery(true);
        } else if (panelData.state === 'Error') {
          setIsValidQuery(false);
        } else {
          setIsValidQuery(undefined);
        }
      });
    }
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
                onRunQuery={() => handleValidation(value)}
                onChange={(value) => {
                  setIsValidQuery(undefined);
                  onChange(value);
                }}
                datasource={datasource}
                query={value}
              />
              <HorizontalGroup justify="flex-end">
                {isValidQuery ? (
                  <div className={styles.valid}>
                    <Icon name="check" /> This query is valid.
                  </div>
                ) : isValidQuery === false ? (
                  <FieldValidationMessage>This query is not valid.</FieldValidationMessage>
                ) : (
                  <div />
                )}
                <Button variant="primary" icon={'check'} type="button" onClick={() => handleValidation(value)}>
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
