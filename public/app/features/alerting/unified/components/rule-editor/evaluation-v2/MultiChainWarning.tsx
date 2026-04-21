import { Controller, useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Field, Select, Stack } from '@grafana/ui';

import { type RecordingRuleDetectionResult } from '../../../hooks/useDetectRecordingRuleReferences';
import { type RuleFormValues } from '../../../types/rule-form';

interface MultiChainWarningProps {
  detection: RecordingRuleDetectionResult;
  onOptOut: () => void;
}

export function MultiChainWarning({ detection, onOptOut }: MultiChainWarningProps) {
  const { control } = useFormContext<RuleFormValues>();

  const chainOptions = detection.chains.map((chain) => ({
    label: `${chain.name} (${chain.interval || 'unknown interval'})`,
    value: chain.uid,
  }));

  return (
    <Stack direction="column" gap={2}>
      <Alert
        severity="warning"
        title={t('alerting.evaluation-v2.multi-chain.title', 'Multiple evaluation chains detected')}
      >
        <Trans i18nKey="alerting.evaluation-v2.multi-chain.message">
          This alert rule queries recording rules from different evaluation chains. Sequential execution of the entire
          chain cannot be guaranteed. You can choose one of the chains or set a custom evaluation interval.
        </Trans>
      </Alert>

      <Field noMargin label={t('alerting.evaluation-v2.multi-chain.select-label', 'Select evaluation chain')}>
        <Controller
          name="evaluationChainUid"
          control={control}
          render={({ field: { ref, ...field } }) => (
            <Select
              {...field}
              options={chainOptions}
              onChange={(option) => field.onChange(option.value)}
              placeholder={t('alerting.evaluation-v2.multi-chain.select-placeholder', 'Choose a chain...')}
              width={40}
            />
          )}
        />
      </Field>

      <Button variant="secondary" fill="text" size="sm" onClick={onOptOut}>
        <Trans i18nKey="alerting.evaluation-v2.multi-chain.opt-out">
          I don&apos;t want to use a chain, let me configure evaluation manually
        </Trans>
      </Button>
    </Stack>
  );
}
