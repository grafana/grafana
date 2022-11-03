import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { Controller } from 'react-hook-form';
import { useAsync } from 'react-use';

import { createQueryRunner, getDataSourceSrv } from '@grafana/runtime';
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

  const handleValidation = (value) => {
    // TODO: TS7006: Parameter 'value' implicitly has an 'any' type.
    // TODO: value is not the right thing to use as it doesn't provide the right data structure for queries below, see packages/grafana-data/src/types/queryRunner.ts
    // trigger query
    const runner = createQueryRunner();
    if (datasource) {
      runner.run({
        datasource: datasource,
        queries: value /*, timezone: TimeZoneUtc, timeRange, maxDataPoints: 100, minInterval: null*/,
      });
      // TODO:TS2345: Argument of type '{ datasource: DataSourceApi<DataQuery, DataSourceJsonData, {}>; queries: any; }'
      //  is not assignable to parameter of type 'QueryRunnerOptions'.
      //  Type '{ datasource: DataSourceApi<DataQuery, DataSourceJsonData, {}>; queries: any; }' is missing the following
      //  properties from type 'QueryRunnerOptions': timezone, timeRange, maxDataPoints, minInterval
    }
    // TODO: Check whether value works for queries?
    // runner.get() // maybe this as well => .subscribe()
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
          // TODO: Check whether datasource.type === 'loki' || 'prometheus' is necessary
          return (
            <>
              <QueryEditor
                onRunQuery={datasource.type === 'loki' || 'prometheus' ? () => handleValidation(value) : () => {}}
                onChange={onChange}
                datasource={datasource}
                query={value}
              />
              <HorizontalGroup justify="flex-end">
                {
                  // TODO: No need to show anything until button is clicked. Introduce another state or use something that's already there
                  isValidQuery ? (
                    <div className={styles.valid}>
                      <Icon name="check" /> This query is valid.
                    </div>
                  ) : (
                    <div className={styles.error}>
                      <Icon name="exclamation-triangle" /> This query is not valid.
                    </div>
                  )
                }
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
