import { css, cx, keyframes } from '@emotion/css';
import { css as cssReact, Global } from '@emotion/react';
import { type CSSProperties, useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';

import { useExtensionSidebarContext } from './ExtensionSidebarProvider';
import { FLOATING_HEIGHT_VARIABLE, FloatingHeightHandle } from './FloatingHeightHandle';
import { FloatingWidthHandle } from './FloatingWidthHandle';
import {
  canCollapseFloatingExtensionSidebar,
  canFloatExtensionSidebar,
  canPlaceExtensionSidebar,
  collapseFloatingExtensionSidebar,
  type ExtensionSidebarDockSide,
  type ExtensionSidebarPresentation,
  resolveExtensionSidebarPresentation,
  setExtensionSidebarPlacement,
} from './extensionSidebarLayout';
import { getComponentMetaFromComponentId } from './extensionSidebarUtils';
import {
  type EdgeActionPreview,
  FLOATING_DRAG_HANDLE_ATTRIBUTE,
  FLOATING_SNAP_DURATION_MS,
  useDockedDrag,
  useFloatingDrag,
  useFloatingHeightRoom,
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
    dockSide,
    extensionSidebarWidth,
    extensionSidebarHeight,
    floatingExtensionSidebarWidth,
    setFloatingExtensionSidebarWidth,
    floatingHeightOptions,
    floatingExtensionSidebarHeight,
    setFloatingExtensionSidebarHeight,
    props = {},
  } = useExtensionSidebarContext();
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
  const floating = presentation === 'floating';
  const floatingHeightRoom = useFloatingHeightRoom(
    floating && floatingExtensionSidebarHeight !== undefined ? wrapper : null
  );
  const pluginId = dockedComponentId ? getComponentMetaFromComponentId(dockedComponentId)?.pluginId : undefined;
  const canDragToFloat =
    !floating && resolveExtensionSidebarPresentation('floating', canFloatExtensionSidebar(), pluginId) === 'floating';
  // The drag reaches the left and bottom docks only while their flag is on.
  const floatingPreview = useFloatingDrag(floating ? wrapper : null, {
    dockWidth: extensionSidebarWidth,
    dockHeight: extensionSidebarHeight,
    onDock: dockExtensionSidebar,
    canDockLeft: canPlaceExtensionSidebar,
    canDockBottom: canPlaceExtensionSidebar,
    canCollapse: canCollapseFloatingExtensionSidebar,
    onCollapse: collapseFloatingExtensionSidebar,
  });
  // Docking on another edge needs what floating needs, and the left and bottom docks need their flag too.
  const dockedPreview = useDockedDrag(canDragToFloat ? wrapper : null, {
    dockSide,
    dockWidth: extensionSidebarWidth,
    dockHeight: extensionSidebarHeight,
    floatingWidth: floatingExtensionSidebarWidth,
    onFloat: floatExtensionSidebar,
    onDock: dockExtensionSidebar,
    canDockLeft: canPlaceExtensionSidebar,
    canDockBottom: canPlaceExtensionSidebar,
  });
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

  // The extension sizes its floating surface with it; unset until the user resizes the height. A height remembered in
  // a taller window is held to the room under the top bar.
  const floatingHeightStyle =
    floating && floatingExtensionSidebarHeight !== undefined
      ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- CSSProperties has no custom properties
        ({
          [FLOATING_HEIGHT_VARIABLE]: `${Math.min(floatingExtensionSidebarHeight, floatingHeightRoom)}px`,
        } as CSSProperties)
      : undefined;

  return (
    <div
      ref={setWrapper}
      className={cx(
        styles.sidebarWrapper,
        !floating && dockSide === 'left' && styles.sidebarWrapperDockedLeft,
        !floating && dockSide === 'bottom' && styles.sidebarWrapperDockedBottom,
        floating && styles.sidebarWrapperFloating,
        (floating || canDragToFloat) && styles.sidebarWrapperDraggable
      )}
      style={floatingHeightStyle}
      // Lets page captures (Composer regions) leave the sidebar out.
      data-extension-sidebar
    >
      {/* Only for an extension that declared a floating height. Before the content, so it comes before the extension's
          header in reading and tab order, on the edge above it. */}
      {floating && floatingHeightOptions && (
        <FloatingHeightHandle
          edge="top"
          options={floatingHeightOptions}
          height={floatingExtensionSidebarHeight}
          onHeightChange={setFloatingExtensionSidebarHeight}
          onWidthChange={setFloatingExtensionSidebarWidth}
        />
      )}
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
      {/* The corner is pointer only, so its place in the tab order does not matter; it paints above both edges. */}
      {floating && floatingHeightOptions && (
        <FloatingHeightHandle
          edge="corner"
          options={floatingHeightOptions}
          height={floatingExtensionSidebarHeight}
          onHeightChange={setFloatingExtensionSidebarHeight}
          onWidthChange={setFloatingExtensionSidebarWidth}
        />
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

function dockExtensionSidebar(side: ExtensionSidebarDockSide) {
  setExtensionSidebarPlacement(side, 'drag');
}

function floatExtensionSidebar() {
  setExtensionSidebarPlacement('floating', 'drag');
}

/**
 * The preview's box. Docked with the visual refresh, the sidebar leaves a gap at its outer side and bottom; so does
 * the preview.
 */
function previewBox(
  { action, side, top, left, width, height }: EdgeActionPreview,
  theme: GrafanaTheme2
): CSSProperties {
  if (action !== 'dock') {
    return { top, left, width, height };
  }
  const gap = theme.flags.visualDesignRefresh ? theme.spacing.gridSize / 2 : 0;
  if (side === 'left') {
    // Mirrors the right dock: the gap is on the nav's side, and the corner there is square.
    return { top, left: left + gap, width: width - gap, height: height - gap, borderTopLeftRadius: 0 };
  }
  if (side === 'bottom') {
    // Inset on both sides and at the bottom, as the docked strip is, in line with the page's card above it.
    return { top, left: left + gap, width: width - 2 * gap, height: height - gap };
  }
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
    // Docked on the left, the border faces the page on the right, and the visual refresh's gap is on the nav's side.
    sidebarWrapperDockedLeft: css(
      {
        borderLeft: 'none',
        borderRight: `1px solid ${theme.colors.border.weak}`,
      },
      visualRefreshEnabled && {
        border: `1px solid ${theme.colors.border.weak}`,
        marginLeft: theme.spacing(0.5),
      }
    ),
    // Docked at the bottom, the border faces the page above. With the visual refresh it is inset as the page's card
    // is, so their left and right edges line up.
    sidebarWrapperDockedBottom: css(
      {
        borderLeft: 'none',
        borderTop: `1px solid ${theme.colors.border.weak}`,
      },
      visualRefreshEnabled && {
        border: `1px solid ${theme.colors.border.weak}`,
        marginLeft: theme.spacing(0.5),
        width: `calc(100% - ${theme.spacing(1)})`,
      }
    ),
    // The extension draws the floating surface itself; core adds no background, border or shadow.
    sidebarWrapperFloating: css({
      // Positions the resize handles on its edges.
      position: 'relative',
      // The extension rounds its surface by this, so the resize handles' lines can follow the corners.
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
