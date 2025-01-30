import { Controller, useFormContext } from 'react-hook-form';

import { Field, Input, Select, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { timeOptions } from '../../utils/time';

import { GroupAndNamespaceFields } from './GroupAndNamespaceFields';
import { RuleEditorSection, RuleEditorSubSection } from './RuleEditorSection';

export const CloudEvaluationBehavior = () => {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const type = watch('type');
  const dataSourceName = watch('dataSourceName');

  // @TODO convert to RuleEditorSubSection(s)
  return (
    <RuleEditorSection stepNo={3} title="Set evaluation behavior" description="Define how the alert rule is evaluated.">
      <RuleEditorSubSection title="Namespace and group">
        {type === RuleFormType.cloudAlerting && dataSourceName && (
          <GroupAndNamespaceFields rulesSourceName={dataSourceName} />
        )}
      </RuleEditorSubSection>

      <RuleEditorSubSection title={t('alerting.rule-form.evaluation-behaviour.pending-period', 'Pending period')}>
        <Stack direction="row" gap={0.5}>
          <Field invalid={!!errors.forTime?.message} error={errors.forTime?.message} style={{ marginBottom: 0 }}>
            <Input
              {...register('forTime', { pattern: { value: /^\d+$/, message: 'Must be a positive integer.' } })}
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
      </RuleEditorSubSection>
    </RuleEditorSection>
  );
};
