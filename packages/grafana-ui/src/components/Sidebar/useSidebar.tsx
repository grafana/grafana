import React, { useCallback, useContext, useEffect } from 'react';
import { useMedia } from 'react-use';

import { store } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { clamp } from '../../utils/clamp';

export type SidebarPosition = 'left' | 'right';

export interface SidebarContextValue {
  isDocked: boolean;
  position: SidebarPosition;
  compact: boolean;
  hasOpenPane?: boolean;
  tabsMode?: boolean;
  outerWrapperProps: React.HTMLAttributes<HTMLDivElement>;
  paneWidth: number;
  bottomMargin: number;
  edgeMargin: number;
  contentMargin: number;
  isHidden: boolean;
  onToggleDock: () => void;
  onResize: (diff: number) => void;
  /** Called when pane is closed or clicked outside of (in undocked mode) */
  onClosePane?: () => void;
  /** Open previous pane */
  onGoBack?: () => void;
  onToggleIsHidden: () => void;
}

export const SidebarContext: React.Context<SidebarContextValue | undefined> = React.createContext<
  SidebarContextValue | undefined
>(undefined);

export const useSidebarContext = () => useContext(SidebarContext);

export interface UseSideBarOptions {
  hasOpenPane?: boolean;
  position?: SidebarPosition;
  tabsMode?: boolean;
  /** Initial state for compact mode */
  defaultToCompact?: boolean;
  /** Initial state for docked mode */
  defaultToDocked?: boolean;
  /** defaults to 2 grid units (16px) */
  bottomMargin?: number;
  /** defaults to 2 grid units (16px) */
  edgeMargin?: number;
  /** defaults to 2 grid units (16px) */
  contentMargin?: number;
  /** Called when pane is closed or clicked outside of (in undocked mode) */
  onClosePane?: () => void;
  /** Open previous pane */
  onGoBack?: () => void;
  /**
   * Optional key to use for persisting sidebar state (docked / compact / size)
   * Can only be app name as the final local storag key will be `grafana.ui.sidebar.{persistanceKey}.{docked|compact|size}`
   */
  persistanceKey?: string;
  /** Whether the sidebar is hidden by default */
  defaultIsHidden?: boolean;
}

export const SIDE_BAR_WIDTH_ICON_ONLY = 5;
export const SIDE_BAR_WIDTH_WITH_TEXT = 8;

export function useSidebar({
  hasOpenPane,
  position = 'right',
  tabsMode,
  defaultToCompact = true,
  defaultToDocked = false,
  bottomMargin = 2,
  edgeMargin = 2,
  contentMargin = 2,
  persistanceKey,
  onClosePane,
  onGoBack,
  defaultIsHidden = false,
}: UseSideBarOptions): SidebarContextValue {
  const theme = useTheme2();
  const [isDocked, setIsDocked] = useSidebarSavedState(persistanceKey, 'docked', defaultToDocked);
  const [compact, setCompact] = useSidebarSavedState(persistanceKey, 'compact', defaultToCompact);
  const [paneWidth, setPaneWidth] = useSidebarSavedState(persistanceKey, 'size', 240);
  const [isHidden, setIsHidden] = useSidebarSavedState(persistanceKey, 'hidden', defaultIsHidden);
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);
  /** Undocked/floating sidebar is not used on small viewports; keep layout and behavior docked. */
  const effectiveIsDocked = Boolean(isMobile) || isDocked;

  // Used to accumulate drag distance to know when to change compact mode
  const [_, setCompactDrag] = React.useState(0);

  const onToggleDock = useCallback(() => {
    if (!isMobile) {
      setIsDocked((prev) => !prev);
    }
  }, [isMobile, setIsDocked]);

  // Calculate how much space the outer wrapper needs to reserve for the sidebar toolbar + pane (if docked)
  const prop = position === 'right' ? 'paddingRight' : 'paddingLeft';
  const toolbarWidth =
    ((compact ? SIDE_BAR_WIDTH_ICON_ONLY : SIDE_BAR_WIDTH_WITH_TEXT) + edgeMargin + contentMargin) *
    theme.spacing.gridSize;

  const outerWrapperProps = isHidden
    ? {}
    : {
        style: {
          [prop]: effectiveIsDocked && hasOpenPane ? paneWidth + toolbarWidth : toolbarWidth,
        },
      };

  const onResize = useCallback(
    (diff: number) => {
      setPaneWidth((prevWidth) => {
        // If no pane is open we use the resize action to toggle compact mode (button text visibility)
        if (!hasOpenPane) {
          setCompactDrag((prevDrag) => {
            const newDrag = prevDrag + diff;
            if (newDrag < -20 && !compact) {
              setCompact(() => true);
              return 0;
            } else if (newDrag > 20 && compact) {
              setCompact(() => false);
              return 0;
            }

            return newDrag;
          });

          return prevWidth;
        }

        const maxWidth = Math.max(window.innerWidth * 0.5, 500);
        return clamp(prevWidth + diff, 100, maxWidth);
      });
    },
    [hasOpenPane, setCompact, setPaneWidth, compact]
  );

  const onToggleIsHidden = useCallback(() => setIsHidden((prev) => !prev), [setIsHidden]);

  return {
    isDocked: effectiveIsDocked,
    onToggleDock,
    onResize,
    outerWrapperProps,
    position,
    compact,
    hasOpenPane,
    tabsMode,
    paneWidth,
    edgeMargin,
    bottomMargin,
    contentMargin,
    isHidden,
    onClosePane,
    onGoBack,
    onToggleIsHidden,
  };
}

function readFromStore<T>(persistanceKey: string | undefined, subKey: string, defaultValue: T): T {
  if (!persistanceKey) {
    return defaultValue;
  }

  if (typeof defaultValue === 'boolean') {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return store.getBool(`grafana.ui.sidebar.${persistanceKey}.${subKey}`, defaultValue) as T;
  }

  if (typeof defaultValue === 'number') {
    const value = Number.parseInt(store.get(`grafana.ui.sidebar.${persistanceKey}.${subKey}`), 10);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Number.isNaN(value) ? defaultValue : (value as T);
  }

  return defaultValue;
}

export function useSidebarSavedState<T = number | boolean>(
  persistanceKey: string | undefined,
  subKey: string,
  defaultValue: T
) {
  const [state, setState] = React.useState<T>(() => readFromStore(persistanceKey, subKey, defaultValue));

  useEffect(() => {
    setState(readFromStore(persistanceKey, subKey, defaultValue));
    // Re-read from storage when the persistence key changes, but not when defaultValue changes
    // to avoid overriding a user-persisted value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistanceKey, subKey]);

  const setPersisted = useCallback(
    (cb: (prevState: T) => T) => {
      setState((prevState) => {
        const newState = cb(prevState);

        if (!persistanceKey) {
          return newState;
        }

        if (persistanceKey) {
          store.set(`grafana.ui.sidebar.${persistanceKey}.${subKey}`, String(newState));
        }

        return newState;
      });
    },
    [persistanceKey, subKey]
  );

  return [state, setPersisted] as const;
}
