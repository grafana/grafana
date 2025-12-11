import { AlertLabels } from '@grafana/alerting/unstable';
import { Labels } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Box, Stack, Text } from '@grafana/ui';
import { GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { stringifyFolder, useFolder } from '../../hooks/useFolder';

import { InstanceLocation } from './InstanceDetailsDrawer';

interface InstanceDetailsDrawerTitleProps {
  instanceLabels: Labels;
  rule?: GrafanaRuleDefinition;
}

export function InstanceDetailsDrawerTitle({ instanceLabels, rule }: InstanceDetailsDrawerTitleProps) {
  const { folder } = useFolder(rule?.namespace_uid);

  return (
    <Stack direction="column" gap={2}>
      <Text variant="h3" element="h3" truncate>
        <Trans i18nKey="alerting.triage.instance-details-drawer.instance-details">Instance details</Trans>
      </Text>
      <Stack direction="row" gap={2}>
        <Box flex={3}>
          {Object.keys(instanceLabels).length > 0 ? (
            <AlertLabels labels={instanceLabels} />
          ) : (
            <Text color="secondary">{t('alerting.triage.no-labels', 'No labels')}</Text>
          )}
        </Box>
        <Box flex={1} />
      </Stack>
      {folder && rule && (
        <InstanceLocation folderTitle={stringifyFolder(folder)} groupName={rule.rule_group} ruleName={rule.title} />
      )}
    </Stack>
  );
}
