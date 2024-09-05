import { css } from '@emotion/css';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { Field, FieldSet, Input, Select, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { CORR_TYPES, CORR_TYPES_QUERY, CorrelationType, ExternalTypeTarget } from '../types';

import { QueryEditorField } from './QueryEditorField';
import { useCorrelationsFormContext } from './correlationsFormContext';
import { FormDTO } from './types';

const getStyles = (theme: GrafanaTheme2) => ({
  typeSelect: css`
    max-width: ${theme.spacing(40)};
  `,
});

export const ConfigureCorrelationTargetForm = () => {
  const { control, formState } = useFormContext<FormDTO>();
  const withDsUID = (fn: Function) => (ds: DataSourceInstanceSettings) => fn(ds.uid);
  const { correlation } = useCorrelationsFormContext();
  const targetUIDFromCorrelation = correlation?.type === CORR_TYPES_QUERY.value ? correlation?.targetUID : undefined;
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
              invalid={!!formState.errors.type}
            >
              <Select
                className={styles.typeSelect}
                value={correlationType}
                onChange={(value) => onChange(value.value)}
                options={Object.values(CORR_TYPES)}
                aria-label="correlation type"
              />
            </Field>
          )}
        />
        {correlationType === 'query' && (
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
                  invalid={!!formState.errors.targetUID}
                  error={formState.errors.targetUID?.message}
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
              invalid={!!formState.errors?.config?.target}
              error={formState.errors?.config?.target?.message}
            />
          </>
        )}
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
                const castVal = value as ExternalTypeTarget; // the target under "query" type can contain anything a datasource query contains
                return (
                  <Field
                    label={t('correlations.target-form.target-label', 'Target')}
                    description={t(
                      'correlations.target-form.target-description-external',
                      'Specify the URL that will open when the link is clicked'
                    )}
                    htmlFor="target"
                    invalid={!!formState.errors.targetUID}
                    error={formState.errors.targetUID?.message}
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
