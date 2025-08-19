import { css } from '@emotion/css';
import { Controller, FieldError, useFormContext, useWatch } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { CorrelationExternal } from '@grafana/runtime';
import { Field, FieldSet, Input, Select, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { CorrelationType } from '../types';

import { QueryEditorField } from './QueryEditorField';
import { useCorrelationsFormContext } from './correlationsFormContext';
import { assertIsQueryTypeError, FormDTO } from './types';

type CorrelationTypeOptions = {
  value: CorrelationType;
  label: string;
  description: string;
};

export const CORR_TYPES_SELECT: Record<CorrelationType, CorrelationTypeOptions> = {
  query: {
    value: 'query',
    label: 'Query',
    description: 'Open a query',
  },
  external: {
    value: 'external',
    label: 'External',
    description: 'Open an external URL',
  },
};

const getStyles = (theme: GrafanaTheme2) => ({
  typeSelect: css({
    maxWidth: theme.spacing(40),
  }),
});

export const ConfigureCorrelationTargetForm = () => {
  const {
    control,
    formState: { errors },
  } = useFormContext<FormDTO>();
  const withDsUID = (fn: Function) => (ds: DataSourceInstanceSettings) => fn(ds.uid);
  const { correlation } = useCorrelationsFormContext();
  const targetUIDFromCorrelation = correlation && 'targetUID' in correlation ? correlation.targetUID : undefined;
  const targetUID: string | undefined = useWatch({ name: 'targetUID' }) || targetUIDFromCorrelation;
  const correlationType: CorrelationType | undefined = useWatch({ name: 'type' }) || correlation?.type;
  const styles = useStyles2(getStyles);

  return (
    <>
      <FieldSet label={t('correlations.target-form.title', 'Setup the target for the correlation (Step 2 of 3)')}>
        <Trans i18nKey="correlations.target-form.sub-text">
          <p>
            Define what the correlation will link to. With the query type, a query will run when the correlation is
            clicked. With the external type, clicking the correlation will open a URL.
          </p>
        </Trans>
        <Controller
          control={control}
          name="type"
          rules={{
            required: { value: true, message: t('correlations.target-form.control-rules', 'This field is required.') },
          }}
          render={({ field: { onChange, value, ...field } }) => (
            <Field
              label={t('correlations.target-form.type-label', 'Type')}
              description={t('correlations.target-form.target-type-description', 'Specify the type of correlation')}
              htmlFor="corrType"
              invalid={!!errors.type}
            >
              <Select
                className={styles.typeSelect}
                value={correlationType}
                onChange={(value) => onChange(value.value)}
                options={Object.values(CORR_TYPES_SELECT)}
                aria-label={t(
                  'correlations.configure-correlation-target-form.aria-label-correlation-type',
                  'Correlation type'
                )}
              />
            </Field>
          )}
        />

        {correlationType === 'query' &&
          (() => {
            assertIsQueryTypeError(errors);
            // the assert above will make sure the form dto, which can be either external or query, is for query
            // however, the query type has config.target, an object, which doesn't get converted, so we must explicity type it below
            return (
              <>
                <Controller
                  control={control}
                  name="targetUID"
                  rules={{
                    required: {
                      value: true,
                      message: t('correlations.target-form.control-rules', 'This field is required.'),
                    },
                  }}
                  render={({ field: { onChange, value } }) => (
                    <Field
                      label={t('correlations.target-form.target-label', 'Target')}
                      description={t(
                        'correlations.target-form.target-description-query',
                        'Specify which data source is queried when the link is clicked'
                      )}
                      htmlFor="target"
                      invalid={!!errors.targetUID}
                      error={errors.targetUID?.message}
                    >
                      <DataSourcePicker
                        onChange={withDsUID(onChange)}
                        noDefault
                        current={value}
                        inputId="target"
                        width={32}
                        disabled={correlation !== undefined}
                      />
                    </Field>
                  )}
                />

                <QueryEditorField
                  name="config.target"
                  dsUid={targetUID}
                  invalid={!!errors?.config?.target}
                  error={
                    errors?.config?.target && 'message' in errors?.config?.target
                      ? (errors?.config?.target as FieldError).message
                      : 'Error'
                  }
                />
              </>
            );
          })()}
        {correlationType === 'external' && (
          <>
            <Controller
              control={control}
              name="config.target"
              rules={{
                required: {
                  value: true,
                  message: t('correlations.target-form.control-rules', 'This field is required.'),
                },
              }}
              render={({ field: { onChange, value } }) => {
                const castVal = value as CorrelationExternal['config']['target']; // the target under "query" type can contain anything a datasource query contains
                return (
                  <Field
                    label={t('correlations.target-form.target-label', 'Target')}
                    description={t(
                      'correlations.target-form.target-description-external',
                      'Specify the URL that will open when the link is clicked'
                    )}
                    htmlFor="target"
                  >
                    <Input
                      value={castVal.url || ''}
                      onChange={(e) => {
                        onChange({ url: e.currentTarget.value });
                      }}
                    />
                  </Field>
                );
              }}
            />
          </>
        )}
      </FieldSet>
    </>
  );
};
