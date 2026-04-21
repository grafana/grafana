import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';

import { useDetectRecordingRuleReferences } from '../../../hooks/useDetectRecordingRuleReferences';
import { EvaluationScenario } from '../../../types/evaluation-chain';
import { type RuleFormValues } from '../../../types/rule-form';
import { isGrafanaAlertingRuleByType } from '../../../utils/rules';
import { RuleEditorSection } from '../RuleEditorSection';

import { ChainRecommendation } from './ChainRecommendation';
import { CommonEvaluationFields } from './CommonEvaluationFields';
import { CreateChainRecommendation } from './CreateChainRecommendation';
import { MultiChainWarning } from './MultiChainWarning';
import { StandaloneEvaluation } from './StandaloneEvaluation';

interface EvaluationBehaviorV2Props {
  existing: boolean;
}

export function EvaluationBehaviorV2({ existing }: EvaluationBehaviorV2Props) {
  const { watch, setValue } = useFormContext<RuleFormValues>();
  const [type, evaluateEvery] = watch(['type', 'evaluateEvery']);
  const isAlertingRule = isGrafanaAlertingRuleByType(type);

  const [userOptedOut, setUserOptedOut] = useState(false);
  const [chainCreated, setChainCreated] = useState(false);
  const detection = useDetectRecordingRuleReferences();

  // The ruler API still requires a group name. Synthesise one from the
  // evaluation interval so rules sharing the same cadence land in the same
  // group. This is a POC workaround until the v2 save path is wired up.
  useEffect(() => {
    setValue('group', evaluateEvery || '1m');
  }, [evaluateEvery, setValue]);

  const handleOptOut = () => setUserOptedOut(true);
  const handleOptIn = () => setUserOptedOut(false);

  function renderScenario(scenario: EvaluationScenario, optedOut: boolean) {
    if (chainCreated || optedOut) {
      return (
        <StandaloneEvaluation
          onOptIn={chainCreated ? undefined : handleOptIn}
          showOptInLink={!chainCreated && scenario !== EvaluationScenario.NoRecordingRules}
        />
      );
    }

    switch (scenario) {
      case EvaluationScenario.NoRecordingRules:
        return <StandaloneEvaluation />;
      case EvaluationScenario.SingleChain:
        return <ChainRecommendation detection={detection} onOptOut={handleOptOut} />;
      case EvaluationScenario.UnchainedRecordingRules:
        return (
          <CreateChainRecommendation
            detection={detection}
            onOptOut={handleOptOut}
            onChainCreated={() => setChainCreated(true)}
          />
        );
      case EvaluationScenario.MultipleChains:
        return <MultiChainWarning detection={detection} onOptOut={handleOptOut} />;
    }
  }

  return (
    <RuleEditorSection stepNo={4} title={t('alerting.evaluation-v2.section-title', 'Set evaluation behavior')}>
      <Stack direction="column" gap={2}>
        {renderScenario(detection.scenario, userOptedOut)}
        <CommonEvaluationFields existing={existing} isAlertingRule={isAlertingRule} />
      </Stack>
    </RuleEditorSection>
  );
}
