import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

import { type RecordingRuleDetectionResult } from '../../../hooks/useDetectRecordingRuleReferences';
import { type RuleFormValues } from '../../../types/rule-form';

import { EvaluationChainInfoCard } from './EvaluationChainInfoCard';

interface ChainRecommendationProps {
  detection: RecordingRuleDetectionResult;
  onOptOut: () => void;
}

export function ChainRecommendation({ detection, onOptOut }: ChainRecommendationProps) {
  const { setValue, watch } = useFormContext<RuleFormValues>();
  const currentChainUid = watch('evaluationChainUid');
  const recommendedChain = detection.chains[0];

  // Auto-select the recommended chain if none is selected
  useEffect(() => {
    if (recommendedChain && !currentChainUid) {
      setValue('evaluationChainUid', recommendedChain.uid);
      setValue('evaluationChainName', recommendedChain.name);
      if (recommendedChain.interval) {
        setValue('evaluateEvery', recommendedChain.interval);
      }
    }
  }, [recommendedChain, currentChainUid, setValue]);

  return (
    <Stack direction="column" gap={2}>
      <Alert
        severity="info"
        title={t('alerting.evaluation-v2.chain-recommendation.title', 'Recording rule dependency detected')}
      >
        <Trans i18nKey="alerting.evaluation-v2.chain-recommendation.message">
          This alert rule queries a recording rule that belongs to an evaluation chain. We recommend adding this alert
          rule to the same chain to ensure the recording rule always evaluates first.
        </Trans>
      </Alert>

      {recommendedChain && <EvaluationChainInfoCard chain={recommendedChain} />}

      <Button variant="secondary" fill="text" size="sm" onClick={onOptOut}>
        <Trans i18nKey="alerting.evaluation-v2.chain-recommendation.opt-out">
          I don&apos;t want to use a chain, let me configure evaluation manually
        </Trans>
      </Button>
    </Stack>
  );
}
