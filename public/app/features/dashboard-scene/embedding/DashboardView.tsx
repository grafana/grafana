import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, EmptyState, Spinner, useStyles2 } from '@grafana/ui';
import { getMessageFromError } from 'app/core/utils/errors';
import { DashboardRoutes } from 'app/types/dashboard';

import { DashboardLifecycleBanner } from '../lifecycle/DashboardLifecycleBanner';
import { type DashboardLifecycleAction } from '../lifecycle/pendingChangePreview';
import { reloadDashboardInPlace, UnifiedDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
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
  /**
   * Any value the host changes when the dashboard or its pending changes moved on, for example after
   * a write: the view loads them again in place, keeping its tab, scroll position and URL state.
   */
  revision?: number;
  /**
   * Called with `revision` once the view shows it: when it loads, and after each reload in place. A
   * host learns from it that the view reloads in place, rather than remounting the view to reload it.
   */
  onRevisionShown?: (revision: number) => void;
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
  revision,
  onRevisionShown,
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

  // The revision the view shows. A newer one from the host loads the dashboard again in place; a
  // load that can't be kept in place (another scene meanwhile, a v1 dashboard) is a fresh one.
  const shownRevision = useRef(revision);
  useEffect(() => {
    if (revision === undefined || revision === shownRevision.current) {
      return;
    }
    shownRevision.current = revision;
    const open = stateManager.state.dashboard;
    const options = { uid, route: DashboardRoutes.Embedded, pendingChanges };
    void (async () => {
      // A reload in place that fails is tried as a fresh one, which reports its own failure, unless a
      // newer revision came meanwhile: its reload shows the dashboard, and a fresh load would replace the
      // scene it reloads in place.
      const inPlace = open ? await reloadDashboardInPlace(stateManager, open, options).catch(() => false) : false;
      if (!inPlace && shownRevision.current === revision) {
        await stateManager.reloadDashboardFresh(options);
      }
      if (shownRevision.current === revision) {
        onRevisionShown?.(revision);
      }
    })().catch(() => {});
    // Only a new revision reloads; the load effect above covers the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);
  const loaded = dashboard !== undefined && dashboard !== null;
  useEffect(() => {
    if (loaded && shownRevision.current !== undefined) {
      onRevisionShown?.(shownRevision.current);
    }
    // Once per load: each reload in place reports its revision itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

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
