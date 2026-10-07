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
  'Migrate the variables on this dashboard that can become filters or group by into a single filters ' +
  'variable with group by enabled. Filters and group by apply to queries automatically, so remove migrated ' +
  'variables from queries. Elsewhere (titles, descriptions, links, text), $job becomes ${filters["job"]}, ' +
  'keeping any format. Carry current selections over as default filters and default group by with dashboard origin. ' +
  'A variable set to All becomes operator =| with value $__all, not =~ .* and not a list of values. ' +
  'If the variables use a datasource variable such as ${ds}, give the filters variable that same datasource.';

const GLOBAL_DISMISS_KEY = 'grafana.dashboard.drilldownMigrationAssistantSuggestion.dismissedGlobally';

function getPerDashboardDismissKey(uid: string): string {
  return `grafana.dashboard.${uid}.drilldownMigrationAssistantSuggestion.dismissed`;
}

interface Props {
  dashboard: DashboardScene;
}

export function DrilldownMigrationSuggestionBanner({ dashboard }: Props) {
  const flagEnabled = useFlagGrafanaDrilldownMigrationAssistantSuggestion();
  // `$variables` is replaced wholesale by every variable mutation (incl. the Assistant's), so it
  // doubles as the signal to re-detect - e.g. to hide the banner once the migration is done.
  const { uid, meta, $variables } = dashboard.useState();
  const styles = useStyles2(getStyles);

  const [assistantAvailable, setAssistantAvailable] = useState(false);
  const [candidates, setCandidates] = useState<MigrationSuggestionCandidate[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const subscription = isAssistantAvailable().subscribe(setAssistantAvailable);
    return () => subscription.unsubscribe();
  }, []);

  const canEdit = Boolean(meta?.canEdit || meta?.canSave);
  const dismissedGlobally = store.getBool(GLOBAL_DISMISS_KEY, false);
  const dismissedForDashboard = Boolean(uid) && store.getBool(getPerDashboardDismissKey(uid!), false);

  // `dashboardUnifiedDrilldownControls` is `Generate{LegacyFrontend: true}` only - it has no
  // OpenFeature-generated hook/FlagKeys entry to read it through, so this falls back to the
  // legacy path (same escape hatch `packages/grafana-runtime/src/config.ts` uses for code that
  // has no non-legacy way to reach an existing legacy-only flag).
  // eslint-disable-next-line @grafana/no-config-feature-toggles -- dashboardUnifiedDrilldownControls is LegacyFrontend-only, no OpenFeature accessor exists for it
  const drilldownControlsEnabled = config.featureToggles.dashboardUnifiedDrilldownControls;

  // Detection resolves datasource instances (possibly loading plugin code), so only run it once
  // every other gate passes - otherwise every dashboard load would pay for it.
  const shouldDetect =
    flagEnabled &&
    Boolean(drilldownControlsEnabled) &&
    assistantAvailable &&
    canEdit &&
    Boolean(uid) &&
    !dismissed &&
    !dismissedGlobally &&
    !dismissedForDashboard;

  useEffect(() => {
    if (!shouldDetect) {
      return;
    }

    let cancelled = false;

    detectDrilldownMigrationCandidates(dashboard)
      .then((result) => {
        if (!cancelled) {
          setCandidates(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCandidates([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dashboard, shouldDetect, $variables]);

  if (!shouldDetect || !uid || candidates.length === 0) {
    return null;
  }

  const onMigrateWithAssistant = () => {
    const highConfidenceCandidates = candidates.filter((candidate) => candidate.confidence === 'high');

    openAssistant({
      origin: 'grafana/dashboard-scene/drilldown-migration-suggestion',
      mode: 'dashboarding',
      prompt: MIGRATION_PROMPT,
      autoSend: true,
      appendContext: true,
      chatId: getAssistantChatIdToContinue(),
      context: [
        createAssistantContextItem('structured', {
          data: {
            // The assistant derives the context pill's label from `name` and crashes rendering it without one.
            name: 'Drilldown migration candidates',
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
            Don&apos;t suggest this again anywhere
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
