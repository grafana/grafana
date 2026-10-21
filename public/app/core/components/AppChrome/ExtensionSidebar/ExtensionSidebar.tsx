import { css, cx, keyframes } from '@emotion/css';
import { css as cssReact, Global } from '@emotion/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';

import { useExtensionSidebarContext } from './ExtensionSidebarProvider';
import { type ExtensionSidebarPresentation, setExtensionSidebarPresentation } from './extensionSidebarLayout';
import { getComponentMetaFromComponentId } from './extensionSidebarUtils';
import { FLOATING_DRAG_HANDLE_ATTRIBUTE, FLOATING_SNAP_DURATION_MS, useFloatingDrag } from './useFloatingDrag';

type ExtensionSidebarComponentProps = {
  props?: Record<string, unknown>;
  extensionSidebarPresentation?: ExtensionSidebarPresentation;
};

export function ExtensionSidebar() {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const { dockedComponentId, presentation, extensionSidebarWidth, props = {} } = useExtensionSidebarContext();
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
  const floating = presentation === 'floating';
  const dockPreview = useFloatingDrag(floating ? wrapper : null, {
    dockWidth: extensionSidebarWidth,
    onDock: dockExtensionSidebar,
  });
  const { components, isLoading } = usePluginComponents<ExtensionSidebarComponentProps>({
    extensionPointId: PluginExtensionPoints.ExtensionSidebar,
  });

  if (isLoading || !dockedComponentId) {
    return null;
  }

  const dockedMeta = getComponentMetaFromComponentId(dockedComponentId);
  if (!dockedMeta) {
    return null;
  }

  const ExtensionComponent = components.find(
    (c) => c.meta.pluginId === dockedMeta.pluginId && c.meta.title === dockedMeta.componentTitle
  );

  if (!ExtensionComponent) {
    return null;
  }

  return (
    <div ref={setWrapper} className={cx(styles.sidebarWrapper, floating && styles.sidebarWrapperFloating)}>
      <div className={styles.content}>
        {/* When the sidebar is open, we don't want the body to scroll */}
        {/* Need type assertion here due to the use of !important */}
        {/* see https://github.com/frenic/csstype/issues/114#issuecomment-697201978 */}
        {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
        <Global styles={[cssReact({ body: { overflowY: 'unset !important' as 'unset' } })]} />
        {/* The presentation is a prop, not a key: changing it re-renders the same instance. */}
        <ExtensionComponent {...props} extensionSidebarPresentation={presentation} />
      </div>
      {/* Portalled: the floating container's transform would otherwise position it. */}
      {dockPreview &&
        createPortal(
          <div className={styles.dockPreview} style={dockPreview} data-testid="extension-sidebar-dock-preview" />,
          document.body
        )}
    </div>
  );
}

function dockExtensionSidebar() {
  setExtensionSidebarPresentation('docked');
}

const getStyles = (theme: GrafanaTheme2) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  return {
    sidebarWrapper: css(
      {
        backgroundColor: theme.colors.background.primary,
        borderLeft: `1px solid ${theme.colors.border.weak}`,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing(1),
        width: '100%',
        height: '100%',
        overflow: 'auto',
        // Temp fix for AI assistant, remove in a 1-2 months
        ' > div > div': {
          margin: 0,
        },
      },
      visualRefreshEnabled && {
        backgroundColor: theme.colors.background.page,
        border: `1px solid ${theme.colors.border.weak}`,
        borderRadius: theme.shape.radius.lg,
        height: `calc(100% - ${theme.spacing(0.5)})`,
        width: `calc(100% - ${theme.spacing(0.5)})`,

        [theme.breakpoints.down('sm')]: {
          height: `calc(100% - ${theme.spacing(0.5)})`,
          margin: theme.spacing(0, 0.5, 0.5, 0.5),
          width: `calc(100% - ${theme.spacing(1)})`,
        },
      }
    ),
    // The extension draws the floating surface itself; core adds no background, border or shadow.
    sidebarWrapperFloating: css({
      // The container around it ignores the pointer, so only the sidebar itself takes clicks where it is.
      pointerEvents: 'auto',
      [`& [${FLOATING_DRAG_HANDLE_ATTRIBUTE}]`]: { cursor: 'grab', touchAction: 'none' },
      [`&[data-dragging], &[data-dragging] [${FLOATING_DRAG_HANDLE_ATTRIBUTE}]`]: { cursor: 'grabbing' },
      // Only the glide to an edge after a drag animates; the drag itself follows the pointer.
      [theme.transitions.handleMotion('no-preference')]: {
        '&[data-snapping]': {
          transition: theme.transitions.create('transform', {
            duration: FLOATING_SNAP_DURATION_MS,
            easing: theme.transitions.easing.easeOut,
          }),
        },
      },
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: 'unset',
      height: 'auto',
      width: '100%',
      margin: 0,
      overflow: 'visible',
      [theme.breakpoints.down('sm')]: {
        height: 'auto',
        margin: 0,
        width: '100%',
      },
    }),
    content: css({
      flex: 1,
      minHeight: 0,
    }),
    // Above the floating container (modalBackdrop + 1), so the sidebar shows through it while it would dock.
    dockPreview: css({
      position: 'fixed',
      zIndex: theme.zIndex.modalBackdrop + 2,
      pointerEvents: 'none',
      backgroundColor: theme.colors.primary.transparent,
      borderLeft: `1px solid ${theme.colors.primary.border}`,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${dockPreviewFadeIn} ${FLOATING_SNAP_DURATION_MS}ms ${theme.transitions.easing.easeOut}`,
      },
    }),
  };
};

const dockPreviewFadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});
