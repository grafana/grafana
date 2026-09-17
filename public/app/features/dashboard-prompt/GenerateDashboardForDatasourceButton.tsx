import { lazy, Suspense, useState } from 'react';

import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { type PromptSeed } from './types';
import { useDashboardGenerationAvailable } from './useDashboardGenerationAvailable';

const GenerateDashboardModal = lazy(() =>
  import('./GenerateDashboardModal').then((module) => ({ default: module.GenerateDashboardModal }))
);

interface Props {
  datasourceUid: string;
  datasourceName: string;
}

/**
 * "Generate dashboard" entry point on a datasource's settings page: opens the
 * prompt pre-seeded with that datasource, so the assistant builds from it
 * without the user having to say which data to use. Hidden when dashboard
 * generation is unavailable (toggle off, assistant missing, or no create
 * permission).
 */
export function GenerateDashboardForDatasourceButton({ datasourceUid, datasourceName }: Props) {
  const [showPrompt, setShowPrompt] = useState(false);
  const isAvailable =
    useDashboardGenerationAvailable() && contextSrv.hasPermission(AccessControlAction.DashboardsCreate);

  if (!isAvailable || datasourceUid === '') {
    return null;
  }

  const seed: PromptSeed = {
    datasourceUids: [datasourceUid],
    promptHint: `The user started from the settings page of the datasource "${datasourceName}" (uid: ${datasourceUid}), so the dashboard should be built from that datasource's data.`,
  };

  return (
    <>
      <Button size="sm" variant="secondary" icon="ai-sparkle" onClick={() => setShowPrompt(true)}>
        {t('dashboard-prompt.datasource-entry.generate-dashboard', 'Generate dashboard')}
      </Button>
      {showPrompt && (
        <Suspense fallback={null}>
          <GenerateDashboardModal seed={seed} onDismiss={() => setShowPrompt(false)} />
        </Suspense>
      )}
    </>
  );
}
