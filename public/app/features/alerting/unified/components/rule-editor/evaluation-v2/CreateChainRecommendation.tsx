import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

import { type RecordingRuleDetectionResult } from '../../../hooks/useDetectRecordingRuleReferences';

import { EvaluationChainCreationModal } from './EvaluationChainCreationModal';

interface CreateChainRecommendationProps {
  detection: RecordingRuleDetectionResult;
  onOptOut: () => void;
  onChainCreated?: () => void;
}

export function CreateChainRecommendation({ detection, onOptOut, onChainCreated }: CreateChainRecommendationProps) {
  const [showModal, setShowModal] = useState(false);
  const ruleNames = detection.referencedRecordingRules.map((r) => r.name).join(', ');

  return (
    <Stack direction="column" gap={2}>
      <Alert
        severity="info"
        title={t('alerting.evaluation-v2.create-chain.title', 'Recording rule dependency detected')}
      >
        <Trans i18nKey="alerting.evaluation-v2.create-chain.message" values={{ ruleNames }}>
          This alert rule queries recording rules ({ruleNames}) that don&apos;t belong to any evaluation chain. We
          recommend creating a new chain to ensure the recording rules always evaluate first.
        </Trans>
      </Alert>

      <Button variant="secondary" icon="plus" onClick={() => setShowModal(true)}>
        <Trans i18nKey="alerting.evaluation-v2.create-chain.create-button">Create evaluation chain</Trans>
      </Button>

      <Button variant="secondary" fill="text" size="sm" onClick={onOptOut}>
        <Trans i18nKey="alerting.evaluation-v2.create-chain.opt-out">
          I don&apos;t want to use a chain, let me configure evaluation manually
        </Trans>
      </Button>

      {showModal && (
        <EvaluationChainCreationModal
          recordingRuleRefs={detection.referencedRecordingRules.map((r) => r.uid)}
          onClose={() => setShowModal(false)}
          onCreated={onChainCreated}
        />
      )}
    </Stack>
  );
}
