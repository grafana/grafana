import { css } from '@emotion/css';
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { ConfirmModal, Menu, Popover, useStyles2 } from '@grafana/ui';

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
      const handleUp = (upEvt: PointerEvent) => {
        window.removeEventListener('pointerup', handleUp);
        const dist = Math.hypot(upEvt.clientX - start.x, upEvt.clientY - start.y);
        // Opens whether the corner was clicked or dragged (drag-end), since either is an attempt to resize.
        openPopover(dist > DRAG_THRESHOLD ? 'drag' : 'press');
      };
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
              <Menu>
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
