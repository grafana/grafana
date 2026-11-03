import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, EmptyState, Spinner, useStyles2 } from '@grafana/ui';
import { getMessageFromError } from 'app/core/utils/errors';
import { DashboardRoutes } from 'app/types/dashboard';

import { DashboardLifecycleBanner } from '../lifecycle/DashboardLifecycleBanner';
import { type DashboardLifecycleAction } from '../lifecycle/pendingChangePreview';
import { UnifiedDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { DashboardOverlay } from '../scene/DashboardOverlay';
import { type DashboardScene } from '../scene/DashboardScene';

export interface DashboardViewProps {
  /** The dashboard to render, by `metadata.name`. */
  uid: string;
  /** Background for the sticky controls row. */
  controlsBackground?: string;
  /** The dashboard title, reported when it loads, for a host that labels a tab with it. */
  onTitleChange?: (title: string) => void;
  /**
   * Pending changes to preview, by the id their plugin's loader knows them by (see
   * grafana/dashboard/pending-changes/v1).
   */
  pendingChanges?: string;
  /** Reports a completed action so the host can update its selected dashboard reference. */
  onLifecycleChange?: (action: DashboardLifecycleAction) => void;
}

/**
 * EXPOSED COMPONENT (experimental, behind `assistant.dashboard.artifacts`): `grafana/dashboard-view/v1`
 *
 * A saved dashboard rendered outside the dashboard route, with its pending changes
 * banner and lifecycle actions, for a host such as the Grafana Assistant Workspace canvas.
 * Full editing happens on the dashboard page; a draft can be saved in place.
 *
 * Uses its own page state manager rather than the route's singleton, so mounting it
 * never clears or replaces the dashboard the route has open. Treat props and visible
 * behavior as a stable contract; breaking changes go to a new v2 component.
 */
export function DashboardView({
  uid,
  controlsBackground,
  onTitleChange,
  pendingChanges,
  onLifecycleChange,
}: DashboardViewProps) {
  const stateManager = useMemo(() => new UnifiedDashboardScenePageStateManager({}), []);
  const { dashboard, loadError } = stateManager.useState();

  useEffect(() => {
    stateManager.loadDashboard({ uid, route: DashboardRoutes.Embedded, pendingChanges });
    return () => {
      stateManager.clearState();
    };
  }, [stateManager, uid, pendingChanges]);

  const reload = useCallback(
    () => stateManager.reloadDashboardFresh({ uid, route: DashboardRoutes.Embedded, pendingChanges }),
    [stateManager, uid, pendingChanges]
  );

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
  return (
    <DashboardViewRenderer
      key={dashboard.state.key}
      model={dashboard}
      controlsBackground={controlsBackground}
      reload={reload}
      onLifecycleChange={onLifecycleChange}
    />
  );
}

function DashboardViewRenderer({
  model,
  controlsBackground,
  reload,
  onLifecycleChange,
}: {
  model: DashboardScene;
  controlsBackground?: string;
  reload: () => Promise<void>;
  onLifecycleChange?: DashboardViewProps['onLifecycleChange'];
}) {
  const [isActive, setIsActive] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const { controls, body } = model.useState();
  const styles = useStyles2(getStyles, controlsBackground);

  useEffect(() => {
    setIsActive(true);
    return model.activate();
  }, [model]);

  if (!isActive) {
    return null;
  }
  if (discarded) {
    return (
      <EmptyState variant="completed" message={t('dashboard-scene.lifecycle.draft-discarded', 'Draft discarded')} />
    );
  }

  return (
    // DASHBOARD_VIEW_ATTRIBUTE: keeps the pending changes highlights to this view's panels.
    <div className={styles.root} data-dashboard-view="">
      <DashboardLifecycleBanner
        dashboard={model}
        placement="embedded"
        reload={reload}
        onLifecycleChange={onLifecycleChange}
        onDiscardDraft={() => setDiscarded(true)}
      />
      <DashboardOverlay
        dashboard={model}
        onDismissLoading={() => {
          if (model.state.isEditing) {
            model.exitEditMode({ skipConfirm: true, restoreInitialState: true });
          }
        }}
      />
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
