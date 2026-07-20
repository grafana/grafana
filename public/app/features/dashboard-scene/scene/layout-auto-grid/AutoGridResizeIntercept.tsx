import { css } from '@emotion/css';
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { ConfirmModal, Menu, Popover, Text, useStyles2 } from '@grafana/ui';

import { DashboardInteractions } from '../../utils/interactions';
import {
  getLayoutContainer,
  getLayoutScope,
  selectAndEditLayout,
  switchAutoGridToCustom,
} from '../layouts-shared/autoLayoutActions';

import { type AutoGridItem } from './AutoGridItem';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

export interface AutoGridResizeInterceptProps {
  /** The auto grid item whose panel is being (attempted to be) resized. */
  item: AutoGridItem;
}

// Movement beyond this (px) counts the gesture as a drag rather than a click.
const DRAG_THRESHOLD = 5;

// Damped follow for the resize-drag hint: moves ~a quarter of the drag distance, capped, so the
// panel only nudges before springing back — never tracking the pointer 1:1.
function resist(delta: number): number {
  return Math.sign(delta) * Math.min(Math.abs(delta) * 0.25, 24);
}

/**
 * An invisible interaction zone placed where a resize handle would normally live in a custom grid.
 * Auto layout has no per-panel sizing, so instead of a dead corner we intercept the gesture and
 * open a popover explaining what happened and offering the two ways out.
 *
 * The popover is controlled (not a click-triggered Dropdown) because a real drag suppresses the
 * synthetic `click`: we detect the gesture ourselves on pointer-release and open on drag-end too.
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

  const { manager, container, scope } = useMemo(() => {
    const mgr = sceneGraph.getAncestor(item, AutoGridLayoutManager);
    const cont = getLayoutContainer(mgr);
    return { manager: mgr, container: cont, scope: getLayoutScope(cont) };
  }, [item]);

  const openPopover = useCallback(
    (trigger: 'press' | 'drag') => {
      actionTakenRef.current = false;
      openRef.current = true;
      DashboardInteractions.autoLayoutResizeIntercepted({ scope, trigger });
      setOpen(true);
    },
    [scope]
  );

  const closePopover = useCallback(() => {
    if (!openRef.current) {
      return;
    }
    openRef.current = false;
    if (!actionTakenRef.current) {
      DashboardInteractions.autoLayoutInterceptResolved({ scope, action: 'dismissed' });
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

  const onZonePointerDown = useCallback(
    (evt: ReactPointerEvent<HTMLButtonElement>) => {
      // Prevent the auto grid from starting a panel drag from this corner.
      evt.stopPropagation();

      // If the popover is already open, the document pointer-down handler closes it — do nothing else.
      if (openRef.current) {
        return;
      }

      const start = { x: evt.clientX, y: evt.clientY };
      // The panel wrapper is this zone's parent; drag feedback is applied to it, not neighbours.
      const panelEl = evt.currentTarget.parentElement;
      const rect = panelEl?.getBoundingClientRect();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let moved = false;

      // Keep the resize cursor for the whole gesture — otherwise it reverts once the pointer leaves
      // the small corner zone while dragging.
      document.body.style.cursor = 'nwse-resize';
      const prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';

      const handleMove = (moveEvt: PointerEvent) => {
        if (!panelEl || !rect) {
          return;
        }
        moved = true;
        // Stretch from the top-left so dragging the bottom-right corner grows the panel a little —
        // a resize hint — with heavy resistance. It springs back on release. Neighbours don't reflow.
        const sx = rect.width > 0 ? (rect.width + resist(moveEvt.clientX - start.x)) / rect.width : 1;
        const sy = rect.height > 0 ? (rect.height + resist(moveEvt.clientY - start.y)) / rect.height : 1;
        panelEl.style.transformOrigin = 'top left';
        panelEl.style.transition = 'none';
        panelEl.style.transform = `scale(${sx}, ${sy})`;
      };

      const handleUp = (upEvt: PointerEvent) => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);

        document.body.style.cursor = '';
        document.body.style.userSelect = prevUserSelect;

        const dist = Math.hypot(upEvt.clientX - start.x, upEvt.clientY - start.y);
        // Opens whether the corner was clicked or dragged (drag-end), since either is an attempt to resize.
        const trigger = dist > DRAG_THRESHOLD ? 'drag' : 'press';

        // No stretch to undo (a click, or reduced motion) — open immediately at the resize corner.
        if (!moved || !panelEl) {
          if (panelEl) {
            panelEl.style.transition = 'none';
            panelEl.style.transform = '';
            panelEl.style.transformOrigin = '';
          }
          openPopover(trigger);
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
          openPopover(trigger);
        };
        panelEl.addEventListener('transitionend', finish);
        panelEl.style.transition = 'transform 0.2s ease-out';
        panelEl.style.transform = '';
        window.setTimeout(finish, 300);
      };

      if (!reducedMotion) {
        window.addEventListener('pointermove', handleMove);
      }
      window.addEventListener('pointerup', handleUp, { once: true });
    },
    [openPopover]
  );

  const onEditAutoLayout = useCallback(() => {
    actionTakenRef.current = true;
    openRef.current = false;
    setOpen(false);
    DashboardInteractions.autoLayoutInterceptResolved({ scope, action: 'edit_auto_layout' });
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
    DashboardInteractions.autoLayoutInterceptResolved({ scope, action: 'switch_to_custom' });
    switchAutoGridToCustom(manager);
  }, [manager, scope]);

  return (
    <>
      <button
        ref={setRefEl}
        type="button"
        className={styles.zone}
        aria-label={t('dashboard.auto-grid.resize-intercept.aria-label', 'Panel sizes are managed by auto layout')}
        aria-haspopup="menu"
        aria-expanded={open}
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
      <ConfirmModal
        isOpen={showConfirm}
        title={t('dashboard.layout.panel.modal.title', 'Change layout')}
        body={t('dashboard.layout.panel.modal.body', 'Changing the layout will reset all panel positions and sizes.')}
        confirmText={t('dashboard.layout.panel.modal.confirm', 'Change layout')}
        dismissText={t('dashboard.layout.panel.modal.dismiss', 'Cancel')}
        confirmVariant="primary"
        onConfirm={onConfirmSwitch}
        onDismiss={() => setShowConfirm(false)}
      />
    </>
  );
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
    // Invite the resize gesture even though the handle is intentionally absent.
    cursor: 'nwse-resize',
    zIndex: 1,
  }),
});
