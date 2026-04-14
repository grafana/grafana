import { type JSX, useCallback } from 'react';

import { Pages } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import {
  isAdvisorEnabled,
  useCreateDatasourceAdvisorChecks,
  useLatestDatasourceCheck,
} from '../../hooks/useDatasourceAdvisorChecks';

export function RunAdvisorChecksButton(): JSX.Element | null {
  const { createChecks, isCreatingChecks, isAvailable } = useCreateDatasourceAdvisorChecks();
  const { check, isLoading: isLatestCheckLoading } = useLatestDatasourceCheck();
  const advisorEnabled = isAdvisorEnabled();

  const onClick = useCallback(() => {
    createChecks();
  }, [createChecks]);

  // Keep the button visible while checks are running, but hide it once
  // onboarding is complete (a check exists and checks are no longer running).
  if (!advisorEnabled || !isAvailable) {
    return null;
  }

  if (!isCreatingChecks && (isLatestCheckLoading || check)) {
    return null;
  }

  return (
    <Button
      icon={isCreatingChecks ? 'spinner' : 'sync'}
      variant="secondary"
      onClick={onClick}
      disabled={isCreatingChecks}
      tooltip={t(
        'data-sources.run-advisor-checks-button.tooltip',
        'Advisor checks helps you find issues with your data sources and plugins'
      )}
      data-testid={Pages.DataSources.advisorRunChecksButton}
    >
      {isCreatingChecks ? (
        <Trans i18nKey="data-sources.run-advisor-checks-button.running">Running checks</Trans>
      ) : (
        <Trans i18nKey="data-sources.run-advisor-checks-button.label">Enable Advisor checks</Trans>
      )}
    </Button>
  );
}
