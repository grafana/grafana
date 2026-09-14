import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { Alert, Spinner, useStyles2 } from '@grafana/ui';
import { getMessageFromError } from 'app/core/utils/errors';
import { UnifiedDashboardScenePageStateManager } from 'app/features/dashboard-scene/pages/DashboardScenePageStateManager';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { useScenesFlickeringFix } from 'app/features/dashboard-scene/utils/utils';
import { DashboardRoutes } from 'app/types/dashboard';

// Wait before loading so arrowing through the results doesn't fire a dashboard load (and its panel queries)
// for every row passed on the way.
const PREVIEW_DELAY_MS = 350;

/**
 * Live preview of a dashboard for the palette detail pane. Modeled on EmbeddedDashboard, but owns its scene
 * state manager instance: the shared singleton drives the dashboard page itself, and loading another dashboard
 * into it would break the page the palette is floating above.
 */
export function DashboardPreview({ uid }: { uid: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setReady(true), PREVIEW_DELAY_MS);
    return () => clearTimeout(timeout);
  }, []);

  if (!ready) {
    return <Spinner />;
  }

  return <DashboardPreviewLoader uid={uid} />;
}

function DashboardPreviewLoader({ uid }: { uid: string }) {
  const stateManager = useMemo(() => new UnifiedDashboardScenePageStateManager({}), []);
  const { dashboard, loadError } = stateManager.useState();

  useScenesFlickeringFix();

  useEffect(() => {
    stateManager.loadDashboard({ uid, route: DashboardRoutes.Embedded });
    return () => {
      stateManager.clearState();
    };
  }, [stateManager, uid]);

  if (loadError) {
    return (
      <Alert severity="error" title={t('cmdk.dashboard-preview.error', 'Failed to load dashboard preview')}>
        {getMessageFromError(loadError)}
      </Alert>
    );
  }

  if (!dashboard) {
    return <Spinner />;
  }

  return <DashboardPreviewRenderer model={dashboard} />;
}

function DashboardPreviewRenderer({ model }: { model: DashboardScene }) {
  const styles = useStyles2(getStyles);
  const [isActive, setIsActive] = useState(false);
  const { body } = model.useState();
  const { variables } = sceneGraph.getVariables(model).useState();

  // Variables like the scopes variable resolve through a hidden React renderer bridging react context into the
  // scene. It is normally mounted by the dashboard controls, which the preview does not render — without it the
  // variable stays loading forever and every panel query is skipped.
  const hiddenContextVariables = variables.filter((variable) => variable.UNSAFE_renderAsHidden);

  useEffect(() => {
    setIsActive(true);
    return model.activate();
  }, [model]);

  if (!isActive) {
    return null;
  }

  return (
    <div className={styles.preview}>
      {hiddenContextVariables.map((variable) => (
        <variable.Component key={variable.state.key} model={variable} />
      ))}
      <body.Component model={body} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    preview: css({
      display: 'flex',
      flexDirection: 'column',
      height: 600,
      // A passive preview: panel menus, links and tooltips inside the palette would fight with the palette's
      // own mouse handling.
      pointerEvents: 'none',
    }),
  };
};
