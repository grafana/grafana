import { useMemo } from 'react';

import { Labels } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { Alert, Box, Drawer, Stack } from '@grafana/ui';
import { GrafanaRuleIdentifier } from 'app/types/unified-alerting';

import { AlertLabels } from '../../components/AlertLabels';
import { useCombinedRule } from '../../hooks/useCombinedRule';
import { stringifyErrorLike } from '../../utils/misc';

interface InstanceDetailsDrawerProps {
  ruleUID: string;
  instanceLabels: Labels;
  onClose: () => void;
}

export function InstanceDetailsDrawer({ ruleUID, instanceLabels, onClose }: InstanceDetailsDrawerProps) {
  // Create rule identifier for Grafana managed rules
  const ruleIdentifier: GrafanaRuleIdentifier = useMemo(
    () => ({
      uid: ruleUID,
      ruleSourceName: 'grafana',
    }),
    [ruleUID]
  );

  // Fetch rule data to get alert instances
  const {
    loading,
    error,
    result: rule,
  } = useCombinedRule({
    ruleIdentifier,
  });

  if (error) {
    return (
      <Drawer title={t('alerting.triage.instance-details', 'Instance Details')} onClose={onClose} size="md">
        <ErrorContent error={error} />
      </Drawer>
    );
  }

  if (loading || !rule) {
    return (
      <Drawer title={t('alerting.triage.instance-details', 'Instance Details')} onClose={onClose} size="md">
        <div>{t('alerting.common.loading', 'Loading...')}</div>
      </Drawer>
    );
  }

  return (
    <Drawer
      title={t('alerting.instance-details-drawer.title-instance-details', 'Instance Details')}
      onClose={onClose}
      size="md"
    >
      <Stack direction="column" gap={3}>
        {/* Instance Labels */}
        <Box>
          <AlertLabels labels={instanceLabels} />
        </Box>
      </Stack>
    </Drawer>
  );
}

interface ErrorContentProps {
  error: unknown;
}

function ErrorContent({ error }: ErrorContentProps) {
  if (isFetchError(error) && error.status === 404) {
    return (
      <Alert title={t('alerting.triage.rule-not-found', 'Rule not found')} severity="error">
        {t('alerting.triage.rule-not-found.description', 'The requested rule could not be found.')}
      </Alert>
    );
  }

  return (
    <Alert title={t('alerting.triage.error-loading-rule', 'Error loading rule')} severity="error">
      {stringifyErrorLike(error)}
    </Alert>
  );
}
