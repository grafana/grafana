import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { createAssistantContextItem, isAssistantAvailable, openAssistant } from '@grafana/assistant';
import { store, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useFlagGrafanaDrilldownMigrationAssistantSuggestion } from '@grafana/runtime/internal';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { getAssistantChatIdToContinue } from 'app/core/components/AssistantTooltip/assistantSidebarState';

import { type DashboardScene } from '../scene/DashboardScene';

import { detectDrilldownMigrationCandidates, type MigrationSuggestionCandidate } from './detect';

// Prompt text sent to the assistant is intentionally not translated (matching
// investigatePanelErrorsWithAssistant() in setDashboardPanelContext.ts): it's an instruction to
// the LLM, not rendered UI copy, so it stays in English regardless of UI locale.
const MIGRATION_PROMPT =
  'look at this dashboard and see if any variables can be migrated to filters and group by and do it';

const GLOBAL_DISMISS_KEY = 'grafana.dashboard.drilldownMigrationAssistantSuggestion.dismissedGlobally';

function getPerDashboardDismissKey(uid: string): string {
  return `grafana.dashboard.${uid}.drilldownMigrationAssistantSuggestion.dismissed`;
}

interface Props {
  dashboard: DashboardScene;
}

export function DrilldownMigrationSuggestionBanner({ dashboard }: Props) {
  const flagEnabled = useFlagGrafanaDrilldownMigrationAssistantSuggestion();
  const { uid, meta } = dashboard.useState();
  const styles = useStyles2(getStyles);

  const [assistantAvailable, setAssistantAvailable] = useState(false);
  const [candidates, setCandidates] = useState<MigrationSuggestionCandidate[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const subscription = isAssistantAvailable().subscribe(setAssistantAvailable);
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    detectDrilldownMigrationCandidates(dashboard).then((result) => {
      if (!cancelled) {
        setCandidates(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dashboard]);

  const canEdit = Boolean(meta?.canEdit || meta?.canSave);
  const dismissedGlobally = store.getBool(GLOBAL_DISMISS_KEY, false);
  const dismissedForDashboard = Boolean(uid) && store.getBool(getPerDashboardDismissKey(uid!), false);

  // `dashboardUnifiedDrilldownControls` is `Generate{LegacyFrontend: true}` only - it has no
  // OpenFeature-generated hook/FlagKeys entry to read it through, so this falls back to the
  // legacy path (same escape hatch `packages/grafana-runtime/src/config.ts` uses for code that
  // has no non-legacy way to reach an existing legacy-only flag).
  // eslint-disable-next-line @grafana/no-config-feature-toggles -- dashboardUnifiedDrilldownControls is LegacyFrontend-only, no OpenFeature accessor exists for it
  const drilldownControlsEnabled = config.featureToggles.dashboardUnifiedDrilldownControls;

  if (
    !flagEnabled ||
    !drilldownControlsEnabled ||
    !assistantAvailable ||
    !canEdit ||
    !uid ||
    dismissed ||
    dismissedGlobally ||
    dismissedForDashboard ||
    candidates.length === 0
  ) {
    return null;
  }

  const onMigrateWithAssistant = () => {
    const highConfidenceCandidates = candidates.filter((candidate) => candidate.confidence === 'high');

    openAssistant({
      origin: 'grafana/dashboard-scene/drilldown-migration-suggestion',
      mode: 'assistant',
      prompt: MIGRATION_PROMPT,
      autoSend: true,
      appendContext: true,
      chatId: getAssistantChatIdToContinue(),
      context: [
        createAssistantContextItem('structured', {
          data: {
            dashboardUid: uid,
            candidates: highConfidenceCandidates,
          },
        }),
      ],
    });
  };

  const onDismiss = () => {
    store.set(getPerDashboardDismissKey(uid), true);
    setDismissed(true);
  };

  const onDismissGlobally = () => {
    store.set(GLOBAL_DISMISS_KEY, true);
    setDismissed(true);
  };

  return (
    <Alert
      severity="info"
      title={t(
        'dashboard-scene.drilldown-migration-suggestion-banner.title',
        'This dashboard may benefit from filters and group by'
      )}
      style={{ flex: 0 }}
      onRemove={onDismiss}
    >
      <div>
        <Trans i18nKey="dashboard-scene.drilldown-migration-suggestion-banner.body">
          Some variables on this dashboard look like they could be replaced with ad hoc filters or group by. Ask the
          Grafana Assistant to review and migrate them for you.
        </Trans>
      </div>
      <div className={styles.actions}>
        <Button size="sm" onClick={onMigrateWithAssistant}>
          <Trans i18nKey="dashboard-scene.drilldown-migration-suggestion-banner.migrate-button">
            Ask Assistant to migrate
          </Trans>
        </Button>
        <Button
          variant="secondary"
          size="sm"
          fill="text"
          onClick={onDismissGlobally}
          className={styles.dismissGlobally}
        >
          <Trans i18nKey="dashboard-scene.drilldown-migration-suggestion-banner.dismiss-globally">
            Don&apos;t suggest this again
          </Trans>
        </Button>
      </div>
    </Alert>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    actions: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(2),
      marginTop: theme.spacing(1),
    }),
    dismissGlobally: css({
      marginTop: 0,
      marginLeft: 0,
      paddingLeft: 0,
      paddingRight: 0,
      fontSize: '0.875rem',
      color: theme.colors.text.secondary,
    }),
  };
}
