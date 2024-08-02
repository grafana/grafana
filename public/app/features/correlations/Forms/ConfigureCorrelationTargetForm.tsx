import { Controller, useFormContext, useWatch } from 'react-hook-form';

import { DataSourceInstanceSettings } from '@grafana/data';
import { Field, FieldSet, Input, Select } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import { CORR_CONFIG_TYPES, CorrelationConfigType, ExternalTypeTarget } from '../types';

import { QueryEditorField } from './QueryEditorField';
import { useCorrelationsFormContext } from './correlationsFormContext';
import { FormDTO } from './types';

export const ConfigureCorrelationTargetForm = () => {
  const { control, formState } = useFormContext<FormDTO>();
  const withDsUID = (fn: Function) => (ds: DataSourceInstanceSettings) => fn(ds.uid);
  const { correlation } = useCorrelationsFormContext();
  const targetUID: string | undefined = useWatch({ name: 'targetUID' }) || correlation?.targetUID;
  const configType: CorrelationConfigType | undefined = useWatch({ name: 'config.type' }) || correlation?.config?.type;

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
          name="config.type"
          rules={{
            required: { value: true, message: t('correlations.target-form.control-rules', 'This field is required.') },
          }}
          render={({ field: { onChange, value, ...field } }) => (
            <Field
              label={t('correlations.target-form.target-label', 'Target')}
              description={t('correlations.target-form.target-type-description', 'Specify the type of correlation')}
              htmlFor="corrType"
              invalid={!!formState.errors.config?.type}
            >
              <Select
                {...field}
                value={configType}
                onChange={(value) => onChange(value.value)}
                options={Object.values(CORR_CONFIG_TYPES)}
                aria-label="correlation type"
              />
            </Field>
          )}
        />
        {configType === CORR_CONFIG_TYPES.query.value && (
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
                  description={CORR_CONFIG_TYPES[configType].targetDescription}
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
        {configType === CORR_CONFIG_TYPES.external.value && (
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
              render={({ field: { onChange, value } }) => (
                <Field
                  label={t('correlations.target-form.type-label', 'Type')}
                  description={t(
                    'correlations.target-form.target-description',
                    'Specify which data source is queried when the link is clicked'
                  )}
                  htmlFor="target"
                  invalid={!!formState.errors.targetUID}
                  error={formState.errors.targetUID?.message}
                >
                  <Input
                    value={(value as ExternalTypeTarget).url || ''}
                    onChange={(e) => {
                      onChange({ url: e.currentTarget.value });
                    }}
                  />
                </Field>
              )}
            />
          </>
        )}
      </FieldSet>
    </>
  );
};
