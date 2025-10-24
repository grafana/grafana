import { useFormContext, useWatch } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Field, Stack, Text } from '@grafana/ui';

import { AIImproveLabelsButtonComponent } from '../../../enterprise-components/AI/AIGenImproveLabelsButton/addAIImproveLabelsButton';
import { RuleFormValues } from '../../../types/rule-form';
import { isGrafanaManagedRuleByType, isRecordingRuleByType } from '../../../utils/rules';

import { LabelsInRule } from './LabelsField';

interface LabelsFieldInFormProps {
  onEditClick: () => void;
}
export function LabelsFieldInFormV2({ onEditClick }: LabelsFieldInFormProps) {
  const { control, watch } = useFormContext<RuleFormValues>();

  // Subscribe to label changes so UI updates when modal saves
  const labels = useWatch({ control, name: 'labels' }) ?? [];
  const type = watch('type');

  const isRecordingRule = type ? isRecordingRuleByType(type) : false;
  const isGrafanaManaged = type ? isGrafanaManagedRuleByType(type) : false;

  const text = isRecordingRule
    ? t('alerting.alertform.labels.recording', 'Add labels to your rule.')
    : t(
        'alerting.alertform.labels.alerting',
        'Add labels to your rule for searching, silencing, or routing to a notification policy.'
      );

  const hasLabels = Array.isArray(labels) && labels.length > 0 && labels.some((label) => label?.key || label?.value);

  return (
    <Field
      noMargin
      label={
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Text variant="bodySmall">
            <Trans i18nKey="alerting.labels-field-in-form.labels">Labels</Trans>
          </Text>
          <Text variant="bodySmall" color="secondary">
            {t('alerting.common.optional', '(optional)')}
          </Text>
        </Stack>
      }
    >
      <Stack direction={'column'} gap={2}>
        <Stack direction={'column'} gap={1}>
          <Stack direction={'row'} gap={1}>
            <Text variant="bodySmall" color="secondary">
              {text}
            </Text>
          </Stack>
          {isGrafanaManaged && <AIImproveLabelsButtonComponent />}
        </Stack>
        <Stack>
          {hasLabels ? (
            <Stack direction="row" gap={1} alignItems="center">
              <LabelsInRule labels={labels} />
              <Button variant="secondary" type="button" onClick={onEditClick} size="sm">
                <Trans i18nKey="alerting.labels-field-in-form.edit-labels">Edit labels</Trans>
              </Button>
            </Stack>
          ) : (
            <Stack direction="column" gap={0.5} alignItems="start">
              <Text color="secondary">
                <Trans i18nKey="alerting.labels-field-in-form.no-labels-selected">No labels selected</Trans>
              </Text>
              <Button
                icon="plus"
                type="button"
                variant="secondary"
                onClick={onEditClick}
                size="sm"
                data-testid="add-labels-button"
              >
                <Trans i18nKey="alerting.labels-field-in-form.add-labels">Add labels</Trans>
              </Button>
            </Stack>
          )}
        </Stack>
      </Stack>
    </Field>
  );
}
