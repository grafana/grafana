import { Trans } from '@grafana/i18n';
import { Stack, Text } from '@grafana/ui';

import { useEvaluationChains } from '../../hooks/useEvaluationChains';
import { EvaluationChainsList } from '../components/EvaluationChainsList';

export function EvaluationChainsTab() {
  const { chains, isLoading } = useEvaluationChains();

  return (
    <Stack direction="column" gap={2}>
      <Text variant="body" color="secondary">
        <Trans i18nKey="alerting.rule-list.tabs.evaluation-chains.description">
          Evaluation groups define the order in which recording and alert rules are evaluated, ensuring recording rules
          always run before the alert rules that depend on them.
        </Trans>
      </Text>
      <EvaluationChainsList chains={chains} isLoading={isLoading} />
    </Stack>
  );
}
