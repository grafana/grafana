import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Field, Input, Stack, TextArea } from '@grafana/ui';

import { RuleFormValues } from '../../../../types/rule-form';
import { Annotation } from '../../../../utils/constants';

export function AnnotationsExpandable() {
  const { register, watch, setValue } = useFormContext<RuleFormValues>();
  const watchedAnnotations = watch('annotations');
  const annotations = useMemo(() => watchedAnnotations ?? [], [watchedAnnotations]);

  // Find indices for summary, description, runbook
  const indices = useMemo(() => {
    const idxByKey: Record<string, number> = {};
    annotations.forEach((a, i) => {
      if (a?.key) {
        idxByKey[a.key] = i;
      }
    });
    return idxByKey;
  }, [annotations]);

  const getOrInit = (key: Annotation, defaultValue = '') => {
    if (indices[key] === undefined) {
      setValue('annotations', [...annotations, { key, value: defaultValue }], { shouldValidate: false });
      return annotations.length; // next index
    }
    return indices[key];
  };

  const summaryIdx = getOrInit(Annotation.summary);
  const descriptionIdx = getOrInit(Annotation.description);
  const runbookIdx = getOrInit(Annotation.runbookURL);

  return (
    <Stack direction="column" gap={2}>
      <Field
        label={t('alerting.create-metadata.label.summary', 'Summary (optional)')}
        description={t('alerting.create-metadata.description.summary', 'Enter a summary of what happened and why...')}
        noMargin
      >
        <TextArea rows={3} width={60} {...register(`annotations.${summaryIdx}.value` as const)} />
      </Field>

      <Field
        label={t('alerting.create-metadata.label.description', 'Description (optional)')}
        description={t(
          'alerting.create-metadata.description.description',
          'Enter a description of what the alert rule does...'
        )}
        noMargin
      >
        <TextArea rows={3} width={60} {...register(`annotations.${descriptionIdx}.value` as const)} />
      </Field>

      <Field
        label={t('alerting.create-metadata.label.runbook-url', 'Runbook URL')}
        description={t(
          'alerting.create-metadata.description.runbook-url',
          'Enter the webpage where you keep your runbook for the alert...'
        )}
        noMargin
      >
        <Input width={60} {...register(`annotations.${runbookIdx}.value` as const)} />
      </Field>
    </Stack>
  );
}
