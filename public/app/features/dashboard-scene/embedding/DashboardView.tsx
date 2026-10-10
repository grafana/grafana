import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Spinner, useStyles2 } from '@grafana/ui';
import { getMessageFromError } from 'app/core/utils/errors';
import { DashboardRoutes } from 'app/types/dashboard';

import { DashboardLifecycleBanner } from '../lifecycle/DashboardLifecycleBanner';
import { UnifiedDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { type DashboardScene } from '../scene/DashboardScene';

export interface DashboardViewProps {
  /** The dashboard to render, by `metadata.name`. */
  uid: string;
  /** Background for the sticky controls row. */
  controlsBackground?: string;
  /** The dashboard title, reported when it loads, for a host that labels a tab with it. */
  onTitleChange?: (title: string) => void;
}

/**
 * EXPOSED COMPONENT (stable): `grafana/dashboard-view/v1`
 *
 * A saved dashboard rendered outside the dashboard route, with its draft or fork
 * banner, for a host such as the Grafana Assistant Workspace canvas. Viewing only:
 * editing happens on the dashboard page (Open in Grafana).
 *
 * Uses its own page state manager rather than the route's singleton, so mounting it
 * never clears or replaces the dashboard the route has open. Treat props and visible
 * behavior as a stable contract; breaking changes go to a new v2 component.
 */
export function DashboardView({ uid, controlsBackground, onTitleChange }: DashboardViewProps) {
  const stateManager = useMemo(() => new UnifiedDashboardScenePageStateManager({}), []);
  const { dashboard, loadError } = stateManager.useState();

  useEffect(() => {
    stateManager.loadDashboard({ uid, route: DashboardRoutes.Embedded });
    return () => {
      stateManager.clearState();
    };
  }, [stateManager, uid]);

  useEffect(() => {
    if (dashboard?.state.title) {
      onTitleChange?.(dashboard.state.title);
    }
  }, [dashboard, onTitleChange]);

  if (loadError) {
    return (
      <Alert severity="error" title={t('dashboard.errors.failed-to-load', 'Failed to load dashboard')}>
        {getMessageFromError(loadError)}
      </Alert>
    );
  }
  if (!dashboard) {
    return <Spinner />;
  }
  return <DashboardViewRenderer model={dashboard} controlsBackground={controlsBackground} />;
}

function DashboardViewRenderer({ model, controlsBackground }: { model: DashboardScene; controlsBackground?: string }) {
  const [isActive, setIsActive] = useState(false);
  const { controls, body } = model.useState();
  const styles = useStyles2(getStyles, controlsBackground);

  useEffect(() => {
    setIsActive(true);
    return model.activate();
  }, [model]);

  if (!isActive) {
    return null;
  }

  return (
    <div className={styles.root}>
      <DashboardLifecycleBanner dashboard={model} />
      <div className={cx(styles.canvas, controls && styles.canvasWithControls)}>
        {controls && (
          <div className={styles.controls}>
            <controls.Component model={controls} />
          </div>
        )}
        <div className={styles.body}>
          <body.Component model={body} />
        </div>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2, controlsBackground?: string) {
  return {
    root: css({
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
    }),
    canvas: css({
      display: 'grid',
      gridTemplateAreas: `"panels"`,
      gridTemplateColumns: '1fr',
      gridTemplateRows: '1fr',
      flexGrow: 1,
    }),
    canvasWithControls: css({
      gridTemplateAreas: `"controls" "panels"`,
      gridTemplateRows: 'auto 1fr',
    }),
    controls: css({
      gridArea: 'controls',
      position: 'sticky',
      top: 0,
      zIndex: theme.zIndex.navbarFixed,
      background: controlsBackground ?? theme.colors.background.canvas,
      padding: theme.spacing(2, 2, 1),
    }),
    body: css({
      gridArea: 'panels',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 2, 2),
    }),
  };
}
