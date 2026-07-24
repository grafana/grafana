import { css } from '@emotion/css';
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type SceneObject, sceneGraph } from '@grafana/scenes';
import { Menu, Popover, Text, useStyles2 } from '@grafana/ui';

import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { type AutoLayoutScope, DashboardInteractions } from '../../utils/interactions';
import { getDashboardSceneFor } from '../../utils/utils';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { TabItem } from '../layout-tabs/TabItem';
import { ConfirmChangeLayoutModal } from '../layouts-shared/DashboardLayoutSelector';
import { layoutRegistry } from '../layouts-shared/layoutRegistry';
import { changeLayoutTo } from '../layouts-shared/utils';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';

import { type AutoGridItem } from './AutoGridItem';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

export interface AutoGridResizeInterceptProps {
  item: AutoGridItem;
}

// Damped follow for the resize-drag hint: moves ~a quarter of the drag distance, capped, so the
// panel only nudges before springing back — never tracking the pointer 1:1.
function resist(delta: number): number {
  return Math.sign(delta) * Math.min(Math.abs(delta) * 0.25, 24);
}

/**
 * An invisible interaction zone placed where a resize handle would normally live in a custom grid.
 * Auto layout has no per-panel sizing, so instead of a dead corner we intercept the gesture and
 * open a popover on pointer-release, once the panel's spring-back has settled.
 */
export function AutoGridResizeIntercept({ item }: AutoGridResizeInterceptProps) {
  const styles = useStyles2(getStyles);
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [refEl, setRefEl] = useState<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const hoverReportedRef = useRef(false);
  const actionTakenRef = useRef(false);
  // teardown for an in-flight pointer gesture; held in a ref so an unmount mid-drag can run it.
  const gestureCleanupRef = useRef<(() => void) | null>(null);

  const { manager, container, scope } = useMemo(() => {
    const mgr = sceneGraph.getAncestor(item, AutoGridLayoutManager);
    const cont = getLayoutContainer(mgr);
    return { manager: mgr, container: cont, scope: getLayoutScope(cont) };
  }, [item]);

  const openPopover = useCallback(() => {
    actionTakenRef.current = false;
    openRef.current = true;
    DashboardInteractions.autoLayoutResizeIntercepted({ scope, trigger: 'drag' });
    setOpen(true);
  }, [scope]);

  const closePopover = useCallback(() => {
    if (!openRef.current) {
      return;
    }
    openRef.current = false;
    if (!actionTakenRef.current) {
      DashboardInteractions.autoLayoutResizeInterceptAction({ scope, action: 'dismissed' });
    }
    setOpen(false);
  }, [scope]);

  // Dismiss on any pointer-down outside the menu. Deferred so the opening gesture doesn't close it.
  useEffect(() => {
    if (!open) {
      return;
    }

    const onDocPointerDown = (evt: PointerEvent) => {
      if (evt.target instanceof Node && menuRef.current?.contains(evt.target)) {
        return;
      }
      closePopover();
    };

    // Capture phase: dashboard rows/panels stopPropagation on pointerdown, so a bubble-phase
    // listener would never see clicks on the canvas.
    const id = window.setTimeout(() => window.addEventListener('pointerdown', onDocPointerDown, true), 0);

    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', onDocPointerDown, true);
    };
  }, [open, closePopover]);

  const onHover = useCallback(() => {
    if (!hoverReportedRef.current) {
      hoverReportedRef.current = true;
      DashboardInteractions.autoLayoutResizeIntercepted({ scope, trigger: 'hover' });
    }
  }, [scope]);

  const onHoverEnd = useCallback(() => {
    hoverReportedRef.current = false;
  }, []);

  // unmount mid-gesture triggers cleanup
  useEffect(() => {
    return () => {
      gestureCleanupRef.current?.();
    };
  }, []);

  const onZonePointerDown = useCallback(
    (evt: ReactPointerEvent<HTMLButtonElement>) => {
      // Prevent the auto grid from starting a panel drag from this corner.
      evt.stopPropagation();

      // if the popover is already open, do nothing
      if (openRef.current) {
        return;
      }

      const start = { x: evt.clientX, y: evt.clientY };
      // The panel wrapper is this zone's parent; drag feedback is applied to it, not neighbours.
      const panelEl = evt.currentTarget.parentElement;
      const rect = panelEl?.getBoundingClientRect();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let moved = false;

      // keep the resize cursor for the whole gesture — otherwise it reverts once the pointer leaves
      // the small corner zone while dragging
      document.body.style.cursor = 'nwse-resize';
      const prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';

      // cleaup listeners and restore styles
      const controller = new AbortController();
      const endGesture = () => {
        controller.abort();
        document.body.style.cursor = '';
        document.body.style.userSelect = prevUserSelect;
        gestureCleanupRef.current = null;
      };
      gestureCleanupRef.current = endGesture;

      const handleMove = (moveEvt: PointerEvent) => {
        if (!panelEl || !rect) {
          return;
        }
        moved = true;
        // Stretch from the top-left so dragging the bottom-right corner grows the panel a little —
        // with heavy resistance. It springs back on release.
        const sx = rect.width > 0 ? (rect.width + resist(moveEvt.clientX - start.x)) / rect.width : 1;
        const sy = rect.height > 0 ? (rect.height + resist(moveEvt.clientY - start.y)) / rect.height : 1;
        panelEl.style.transformOrigin = 'top left';
        panelEl.style.transition = 'none';
        panelEl.style.transform = `scale(${sx}, ${sy})`;
      };

      const handleUp = () => {
        endGesture();

        // No stretch to undo — open immediately at the resize corner.
        if (!moved || !panelEl) {
          if (panelEl) {
            panelEl.style.transition = 'none';
            panelEl.style.transform = '';
            panelEl.style.transformOrigin = '';
          }
          openPopover();
          return;
        }

        // Spring back, then open the popover once the corner has settled back into place so it
        // anchors to the resize corner rather than the displaced position.
        let opened = false;
        const finish = () => {
          if (opened) {
            return;
          }
          opened = true;
          panelEl.removeEventListener('transitionend', finish);
          panelEl.style.transition = '';
          panelEl.style.transformOrigin = '';
          openPopover();
        };
        panelEl.addEventListener('transitionend', finish);
        panelEl.style.transition = 'transform 0.2s ease-out';
        panelEl.style.transform = '';
        window.setTimeout(finish, 300);
      };

      if (!reducedMotion) {
        window.addEventListener('pointermove', handleMove, { signal: controller.signal });
      }
      window.addEventListener('pointerup', handleUp, { signal: controller.signal });
    },
    [openPopover]
  );

  const onEditAutoLayout = useCallback(() => {
    actionTakenRef.current = true;
    openRef.current = false;
    setOpen(false);
    DashboardInteractions.autoLayoutResizeInterceptAction({ scope, action: 'edit_auto_layout' });
    selectAndEditLayout(container);
  }, [container, scope]);

  const onSwitchToCustom = useCallback(() => {
    actionTakenRef.current = true;
    openRef.current = false;
    setOpen(false);
    setShowConfirm(true);
  }, []);

  const onConfirmSwitch = useCallback(() => {
    setShowConfirm(false);
    DashboardInteractions.autoLayoutResizeInterceptAction({ scope, action: 'switch_to_custom' });
    changeLayoutTo(manager, layoutRegistry.get(DefaultGridLayoutManager.descriptor.id));
  }, [manager, scope]);

  return (
    <>
      <button
        ref={setRefEl}
        type="button"
        className={styles.zone}
        aria-label={t('dashboard.auto-grid.resize-intercept.aria-label', 'Panel sizes are managed by auto layout')}
        onMouseEnter={onHover}
        onMouseLeave={onHoverEnd}
        onPointerDown={onZonePointerDown}
      />
      {refEl && (
        <Popover
          show={open}
          placement="bottom-end"
          referenceElement={refEl}
          content={
            <div ref={menuRef}>
              <Menu
                header={
                  <Text variant="bodySmall" color="secondary">
                    {t('dashboard.auto-grid.resize-intercept.header', 'Cannot resize in auto layout')}
                  </Text>
                }
              >
                <Menu.Item
                  icon="apps"
                  label={t('dashboard.auto-grid.resize-intercept.edit', 'Edit auto layout')}
                  onClick={onEditAutoLayout}
                />
                <Menu.Item
                  icon="window-grid"
                  label={t('dashboard.auto-grid.resize-intercept.switch', 'Switch to custom')}
                  onClick={onSwitchToCustom}
                />
              </Menu>
            </div>
          }
        />
      )}
      <ConfirmChangeLayoutModal
        isOpen={showConfirm}
        onConfirm={onConfirmSwitch}
        onDismiss={() => {
          setShowConfirm(false);
        }}
      />
    </>
  );
}

function getLayoutContainer(manager: DashboardLayoutManager): SceneObject {
  return dashboardSceneGraph.findSectionOwner(manager) ?? getDashboardSceneFor(manager);
}

function getLayoutScope(container: SceneObject): AutoLayoutScope {
  if (container instanceof RowItem) {
    return 'row';
  }
  if (container instanceof TabItem) {
    return 'tab';
  }
  return 'dashboard';
}

function selectAndEditLayout(container: SceneObject): void {
  getDashboardSceneFor(container).state.editPane.selectObject(container, { force: true });
}

const getStyles = (theme: GrafanaTheme2) => ({
  zone: css({
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: theme.spacing(2.5),
    height: theme.spacing(2.5),
    padding: 0,
    margin: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'nwse-resize',
    zIndex: 1,
  }),
});
