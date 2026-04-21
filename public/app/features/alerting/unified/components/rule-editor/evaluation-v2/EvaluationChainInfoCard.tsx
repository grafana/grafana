import { Trans } from '@grafana/i18n';
import { Box, Stack, Text } from '@grafana/ui';

import { type EvaluationChain } from '../../../types/evaluation-chain';

interface EvaluationChainInfoCardProps {
  chain: EvaluationChain;
}

export function EvaluationChainInfoCard({ chain }: EvaluationChainInfoCardProps) {
  const memberCount = chain.recordingRuleRefs.length + chain.alertRuleRefs.length;

  return (
    <Box borderColor="medium" borderStyle="solid" padding={2} borderRadius="default">
      <Stack direction="column" gap={1}>
        <Text variant="bodySmall" weight="bold">
          {chain.name}
        </Text>
        <Stack direction="row" gap={2}>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.evaluation-v2.chain-info.interval">Interval: {chain.interval}</Trans>
          </Text>
          <Text variant="bodySmall" color="secondary">
            <Trans i18nKey="alerting.evaluation-v2.chain-info.members" values={{ count: memberCount }}>
              {'{{count}}'} members
            </Trans>
          </Text>
        </Stack>
      </Stack>
    </Box>
  );
}
