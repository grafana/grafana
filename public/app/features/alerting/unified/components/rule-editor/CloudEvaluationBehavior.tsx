import { Controller, useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Box, Field, Input, Select, Stack } from '@grafana/ui';

import { RuleFormType, type RuleFormValues } from '../../types/rule-form';
import { timeOptions } from '../../utils/time';

import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { PreviewRule } from './PreviewRule';
import { RuleEditorSection } from './RuleEditorSection';

export const CloudEvaluationBehavior = () => {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const type = watch('type');
  const dataSourceName = watch('dataSourceName');

  return (
    <RuleEditorSection
      stepNo={3}
      title={t('alerting.cloud-evaluation-behavior.title-set-evaluation-behavior', 'Set evaluation behavior')}
    >
      <Box marginBottom={2}>
        <Field
          noMargin
          label={t('alerting.cloud-evaluation-behavior.label-pending-period', 'Pending period')}
          description={t(
            'alerting.cloud-evaluation-behavior.description-pending-period',
            'Period during which the threshold condition must be met to trigger an alert. Selecting "None" triggers the alert immediately once the condition is met.'
          )}
        >
          <Stack direction="row" gap={0.5} alignItems="flex-start">
            <Field noMargin invalid={!!errors.forTime?.message} error={errors.forTime?.message}>
              <Input
                {...register('forTime', {
                  pattern: {
                    value: /^\d+$/,
                    message: t(
                      'alerting.cloud-evaluation-behavior.message.must-be-a-positive-integer',
                      'Must be a positive integer.'
                    ),
                  },
                })}
                width={8}
              />
            </Field>
            <Controller
              name="forTimeUnit"
              render={({ field: { onChange, ref, ...field } }) => (
                <Select {...field} options={timeOptions} onChange={(value) => onChange(value?.value)} width={15} />
              )}
              control={control}
            />
          </Stack>
        </Field>
      </Box>
      {type === RuleFormType.cloudAlerting && dataSourceName && (
        <GroupAndNamespaceFields rulesSourceName={dataSourceName} />
      )}

      <PreviewRule />
    </RuleEditorSection>
  );
};
