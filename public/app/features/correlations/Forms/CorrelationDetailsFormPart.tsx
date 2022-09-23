import { css, cx } from '@emotion/css';
import React from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Field, Input, TextArea, useStyles2, LoadingPlaceholder, Alert } from '@grafana/ui';

import { Correlation } from '../types';

import { FormDTO } from './types';

const getInputId = (inputName: string, correlation?: CorrelationBaseData) => {
  if (!correlation) {
    return inputName;
  }

  return `${inputName}_${correlation.sourceUID}-${correlation.uid}`;
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    max-width: ${theme.spacing(32)};
  `,
  description: css`
    max-width: ${theme.spacing(80)};
  `,
});

type CorrelationBaseData = Pick<Correlation, 'uid' | 'sourceUID' | 'targetUID'>;
interface Props {
  readOnly?: boolean;
  correlation?: CorrelationBaseData;
}

export function CorrelationDetailsFormPart({ readOnly = false, correlation }: Props) {
  const styles = useStyles2(getStyles);
  const {
    register,
    formState: { errors },
  } = useFormContext<FormDTO>();
  const targetUID: string | undefined = useWatch({ name: 'targetUID' }) || correlation?.targetUID;

  const {
    value: datasource,
    loading: dsLoading,
    error,
  } = useAsync(async () => {
    if (!targetUID) {
      return;
    }
    return getDataSourceSrv().get(targetUID);
  }, [targetUID]);

  const QuerEditor = datasource?.components?.QueryEditor;

  return (
    <>
      <Field label="Label" className={styles.label}>
        <Input
          id={getInputId('label', correlation)}
          {...register('label')}
          readOnly={readOnly}
          placeholder="i.e. Tempo traces"
        />
      </Field>

      <Field
        label="Description"
        // the Field component automatically adds margin to itself, so we are forced to workaround it by overriding  its styles
        className={cx(styles.description)}
      >
        <TextArea id={getInputId('description', correlation)} {...register('description')} readOnly={readOnly} />
      </Field>

      <Field
        label="Target field"
        className={styles.label}
        invalid={!!errors?.config?.field}
        error={errors?.config?.field?.message}
      >
        <Input
          id={getInputId('field', correlation)}
          {...register('config.field', { required: 'This field is required.' })}
          readOnly={readOnly}
        />
      </Field>

      <Field
        label="Query"
        invalid={!!errors?.config?.target}
        // @ts-expect-error react-hook-form's errors do not work well with object types
        error={errors?.config?.target?.message}
      >
        <Controller
          name="config.target"
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
            if (error) {
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
    </>
  );
}
