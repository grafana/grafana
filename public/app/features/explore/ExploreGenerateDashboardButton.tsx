import { lazy, Suspense, useState } from 'react';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { type PromptSeed } from 'app/features/dashboard-prompt/types';
import { useDashboardGenerationAvailable } from 'app/features/dashboard-prompt/useDashboardGenerationAvailable';
import { AccessControlAction } from 'app/types/accessControl';
import { useSelector } from 'app/types/store';

const GenerateDashboardModal = lazy(() =>
  import('app/features/dashboard-prompt/GenerateDashboardModal').then((module) => ({
    default: module.GenerateDashboardModal,
  }))
);

interface Props {
  exploreId: string;
}

/**
 * "Generate dashboard" entry point in the Explore toolbar: opens the prompt
 * pre-seeded with the pane's datasource and the queries currently open, so
 * "turn what I'm looking at into a dashboard" needs no re-describing. Hidden
 * when dashboard generation is unavailable (toggle off, assistant missing, or no
 * create permission).
 */
export function ExploreGenerateDashboardButton({ exploreId }: Props) {
  const [showPrompt, setShowPrompt] = useState(false);
  const isAvailable =
    useDashboardGenerationAvailable() && contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
  const pane = useSelector((state) => state.explore.panes[exploreId]);

  if (!isAvailable || !pane) {
    return null;
  }

  const buildSeed = (): PromptSeed => {
    const datasourceUids = new Set<string>();
    const queryLines: string[] = [];

    for (const query of pane.queries) {
      if (typeof query.datasource?.uid === 'string') {
        datasourceUids.add(query.datasource.uid);
      }
      if ('expr' in query && typeof query.expr === 'string' && query.expr.trim() !== '') {
        queryLines.push(`- ${query.expr}`);
      }
    }

    // The pane datasource covers queries without their own ref; a mixed
    // pane's pseudo-uid simply won't match any real datasource downstream.
    const paneUid = pane.datasourceInstance?.uid;
    if (datasourceUids.size === 0 && typeof paneUid === 'string') {
      datasourceUids.add(paneUid);
    }

    return {
      datasourceUids: Array.from(datasourceUids),
      promptHint:
        'The user was just exploring this data in Grafana Explore, so the dashboard should be built around it.' +
        (queryLines.length > 0 ? `\nQueries currently open in Explore:\n${queryLines.join('\n')}` : ''),
    };
  };

  return (
    <>
      <ToolbarButton
        icon="ai-sparkle"
        variant="canvas"
        tooltip={t(
          'explore.generate-dashboard-button.tooltip',
          'Generate a dashboard from this data with the Grafana Assistant'
        )}
        onClick={() => setShowPrompt(true)}
        data-testid="explore-generate-dashboard-button"
      />
      {showPrompt && (
        <Suspense fallback={null}>
          <GenerateDashboardModal seed={buildSeed()} onDismiss={() => setShowPrompt(false)} />
        </Suspense>
      )}
    </>
  );
}
