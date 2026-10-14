import { css, cx } from '@emotion/css';
import { css as cssReact, Global } from '@emotion/react';
import { useLayoutEffect, useState } from 'react';

import { type GrafanaTheme2, PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';
import { type ExtensionSidebarPresentation } from 'app/types/events';

import { useExtensionSidebarContext } from './ExtensionSidebarProvider';
import { getComponentMetaFromComponentId } from './extensionSidebarUtils';
import { FLOATING_DRAG_HANDLE_ATTRIBUTE, useFloatingDrag } from './useFloatingDrag';

/**
 * Space the floating sidebar covers at the bottom of the page, set on the document root while it floats.
 * Page scroll containers pad by it so their last row can scroll above the bar.
 */
export const EXTENSION_FLOATING_INSET_VAR = '--extension-floating-inset';
/**
 * Upper bound for the inset, in CSS px: about a collapsed floating bar plus its gap. The floating panel
 * covers only part of the page, so an expanded one must not pad the whole page by its height.
 */
export const MAX_EXTENSION_FLOATING_INSET = 120;

type ExtensionSidebarComponentProps = {
  props?: Record<string, unknown>;
  extensionSidebarPresentation?: ExtensionSidebarPresentation;
};

export function ExtensionSidebar() {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const { dockedComponentId, presentation, props = {} } = useExtensionSidebarContext();
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
  const floating = presentation === 'floating';
  const { moved } = useFloatingDrag(floating ? wrapper : null);
  // A moved sidebar is not at the bottom of the page, so the page needs no room for it.
  useFloatingInset(floating ? wrapper : null, theme.spacing.gridSize * 3, moved);
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
      className={cx(styles.sidebarWrapper, floating && styles.sidebarWrapperFloating)}
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
    </div>
  );
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
  };
};

/**
 * Publishes the floating sidebar's height as the page inset. Only the sidebar is observed: it is fixed, so
 * the page padding the inset produces never changes its size, and an unchanged size writes nothing.
 */
function useFloatingInset(element: HTMLElement | null, bottomGap: number, moved: boolean) {
  useLayoutEffect(() => {
    if (!element) {
      return;
    }
    const root = document.documentElement;
    let published = '';
    const update = () => {
      const height = Math.round(element.getBoundingClientRect().height + bottomGap);
      const inset = moved ? '0px' : `${Math.min(height, MAX_EXTENSION_FLOATING_INSET)}px`;
      if (inset !== published) {
        published = inset;
        root.style.setProperty(EXTENSION_FLOATING_INSET_VAR, inset);
      }
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(EXTENSION_FLOATING_INSET_VAR);
    };
  }, [element, bottomGap, moved]);
}
