import { css, cx, keyframes } from '@emotion/css';
import { css as cssReact, Global } from '@emotion/react';
import { type CSSProperties, useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';

import { useExtensionSidebarContext } from './ExtensionSidebarProvider';
import { FloatingWidthHandle } from './FloatingWidthHandle';
import {
  canCollapseFloatingExtensionSidebar,
  canFloatExtensionSidebar,
  collapseFloatingExtensionSidebar,
  type ExtensionSidebarPresentation,
  resolveExtensionSidebarPresentation,
  setExtensionSidebarPresentation,
} from './extensionSidebarLayout';
import { getComponentMetaFromComponentId } from './extensionSidebarUtils';
import {
  type EdgeActionPreview,
  FLOATING_DRAG_HANDLE_ATTRIBUTE,
  FLOATING_SNAP_DURATION_MS,
  useDockedDrag,
  useFloatingDrag,
} from './useFloatingDrag';

type ExtensionSidebarComponentProps = {
  props?: Record<string, unknown>;
  extensionSidebarPresentation?: ExtensionSidebarPresentation;
};

export function ExtensionSidebar() {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const {
    dockedComponentId,
    presentation,
    extensionSidebarWidth,
    floatingExtensionSidebarWidth,
    setFloatingExtensionSidebarWidth,
    props = {},
  } = useExtensionSidebarContext();
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
  const floating = presentation === 'floating';
  const pluginId = dockedComponentId ? getComponentMetaFromComponentId(dockedComponentId)?.pluginId : undefined;
  const canDragToFloat =
    !floating && resolveExtensionSidebarPresentation('floating', canFloatExtensionSidebar(), pluginId) === 'floating';
  const floatingPreview = useFloatingDrag(floating ? wrapper : null, {
    dockWidth: extensionSidebarWidth,
    onDock: dockExtensionSidebar,
    canCollapse: canCollapseFloatingExtensionSidebar,
    onCollapse: collapseFloatingExtensionSidebar,
  });
  const dockedPreview = useDockedDrag(
    canDragToFloat ? wrapper : null,
    floatingExtensionSidebarWidth,
    floatExtensionSidebar
  );
  const edgeActionPreview = floatingPreview ?? dockedPreview;
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
    <div
      ref={setWrapper}
      className={cx(
        styles.sidebarWrapper,
        floating && styles.sidebarWrapperFloating,
        (floating || canDragToFloat) && styles.sidebarWrapperDraggable
      )}
      // Lets page captures (Composer regions) leave the sidebar out.
      data-extension-sidebar
    >
      <div className={styles.content}>
        {/* When the sidebar is open, we don't want the body to scroll */}
        {/* Need type assertion here due to the use of !important */}
        {/* see https://github.com/frenic/csstype/issues/114#issuecomment-697201978 */}
        {/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions */}
        <Global styles={[cssReact({ body: { overflowY: 'unset !important' as 'unset' } })]} />
        {/* The presentation is a prop, not a key: changing it re-renders the same instance. */}
        <ExtensionComponent {...props} extensionSidebarPresentation={presentation} />
      </div>
      {floating && (
        <FloatingWidthHandle width={floatingExtensionSidebarWidth} onWidthChange={setFloatingExtensionSidebarWidth} />
      )}
      {/* Portalled: the floating container's transform would otherwise position it. */}
      {edgeActionPreview &&
        createPortal(
          <div
            className={styles.edgeActionPreview}
            style={previewBox(edgeActionPreview, theme)}
            data-testid={`extension-sidebar-${edgeActionPreview.action}-preview`}
          />,
          document.body
        )}
    </div>
  );
}

function dockExtensionSidebar() {
  setExtensionSidebarPresentation('docked');
}

function floatExtensionSidebar() {
  setExtensionSidebarPresentation('floating');
}

/** The preview's box. Docked with the visual refresh, the sidebar leaves a gap at its right and bottom; so does the preview. */
function previewBox({ action, top, left, width, height }: EdgeActionPreview, theme: GrafanaTheme2): CSSProperties {
  if (action !== 'dock') {
    return { top, left, width, height };
  }
  const gap = theme.flags.visualDesignRefresh ? theme.spacing.gridSize / 2 : 0;
  // Flush with the window's top-right corner, so that corner is square.
  return { top, left, width: width - gap, height: height - gap, borderTopRightRadius: 0 };
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
      // Positions the width handle on its edge.
      position: 'relative',
      // The extension rounds its surface by this, so the width handle's line can follow the corners.
      '--extension-sidebar-floating-radius': theme.shape.radius.lg,
      // The container around it ignores the pointer, so only the sidebar itself takes clicks where it is.
      pointerEvents: 'auto',
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
    sidebarWrapperDraggable: css({
      [`& [${FLOATING_DRAG_HANDLE_ATTRIBUTE}]`]: { cursor: 'grab', touchAction: 'none' },
      [`&[data-dragging], &[data-dragging] [${FLOATING_DRAG_HANDLE_ATTRIBUTE}]`]: { cursor: 'grabbing' },
    }),
    content: css({
      flex: 1,
      minHeight: 0,
    }),
    // Looks like the dashboard grid's drop placeholder. Above the floating container (modalBackdrop + 1), so
    // the sidebar shows through it.
    edgeActionPreview: css({
      position: 'fixed',
      zIndex: theme.zIndex.modalBackdrop + 2,
      pointerEvents: 'none',
      backgroundColor: theme.colors.accent.transparent,
      boxShadow: `0 0 4px ${theme.colors.accent.main}`,
      borderRadius: theme.shape.radius.lg,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${previewFadeIn} ${FLOATING_SNAP_DURATION_MS}ms ${theme.transitions.easing.easeOut}`,
      },
    }),
  };
};

const previewFadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});
