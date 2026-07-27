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
  isHiddenPreference: boolean;
  canGoBack?: boolean;
  onToggleDock?: () => void;
  onResize: (diff: number) => void;
  /** Called when pane is closed or clicked outside of (in undocked mode) */
  onClosePane?: () => void;
  /** Open previous pane */
  onGoBack?: () => void;
  onToggleIsHidden: () => void;
  setIsHidden: (value: boolean) => void;
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
  /** Disables go back button */
  canGoBack?: boolean;
  /** Open previous pane */
  onGoBack?: () => void;
  /**
   * Optional key to use for persisting sidebar state (docked / compact / size)
   * Can only be app name as the final local storag key will be `grafana.ui.sidebar.{persistenceKey}.{docked|compact|size}`
   */
  persistenceKey?: string;
  /** Whether the sidebar is hidden by default */
  defaultIsHidden?: boolean;
  /**
   * Optional override for the persistance key used to store the hidden state.
   * Allows the hidden preference to be shared across consumers that otherwise use different
   * persistenceKeys (e.g. dashboard view vs edit mode share a single hide preference).
   */
  hiddenPersistenceKey?: string;
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
  persistenceKey,
  onClosePane,
  onGoBack,
  canGoBack,
  defaultIsHidden = false,
  hiddenPersistenceKey,
}: UseSideBarOptions): SidebarContextValue {
  const theme = useTheme2();
  const [isDocked, setIsDocked] = useSidebarSavedState(persistenceKey, 'docked', defaultToDocked);
  const [compact, setCompact] = useSidebarSavedState(persistenceKey, 'compact', defaultToCompact);
  const [paneWidth, setPaneWidth] = useSidebarSavedState(persistenceKey, 'size', 240);
  const [isHidden, setIsHidden] = useSidebarSavedState(
    hiddenPersistenceKey ?? persistenceKey,
    'hidden',
    defaultIsHidden
  );
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);
  const isTemporarilyShown = isHidden && Boolean(hasOpenPane);
  const effectiveIsHidden = isHidden && !isTemporarilyShown;
  // On small viewports the sidebar is always rendered as an undocked overlay so it doesn't
  // permanently steal horizontal space — docking only applies on larger viewports.
  const effectiveIsDocked = !isTemporarilyShown && !isMobile && isDocked;

  // Used to accumulate drag distance to know when to change compact mode
  const [_, setCompactDrag] = React.useState(0);

  const onToggleDock = useCallback(() => {
    setIsDocked((prev) => !prev);
  }, [setIsDocked]);

  // Calculate how much space the outer wrapper needs to reserve for the sidebar toolbar + pane (if docked)
  const prop = position === 'right' ? 'paddingRight' : 'paddingLeft';
  const toolbarWidth =
    ((compact ? SIDE_BAR_WIDTH_ICON_ONLY : SIDE_BAR_WIDTH_WITH_TEXT) + edgeMargin + contentMargin) *
    theme.spacing.gridSize;

  const outerWrapperProps =
    effectiveIsHidden || isTemporarilyShown
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
  const setIsHiddenValue = useCallback((value: boolean) => setIsHidden(() => value), [setIsHidden]);

  return {
    isDocked: effectiveIsDocked,
    onToggleDock: isMobile || isTemporarilyShown ? undefined : onToggleDock,
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
    isHidden: effectiveIsHidden,
    isHiddenPreference: isHidden,
    onClosePane,
    onGoBack,
    canGoBack,
    onToggleIsHidden,
    setIsHidden: setIsHiddenValue,
  };
}

function readFromStore<T>(persistenceKey: string | undefined, subKey: string, defaultValue: T): T {
  if (!persistenceKey) {
    return defaultValue;
  }

  if (typeof defaultValue === 'boolean') {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return store.getBool(`grafana.ui.sidebar.${persistenceKey}.${subKey}`, defaultValue) as T;
  }

  if (typeof defaultValue === 'number') {
    const value = Number.parseInt(store.get(`grafana.ui.sidebar.${persistenceKey}.${subKey}`), 10);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return Number.isNaN(value) ? defaultValue : (value as T);
  }

  return defaultValue;
}

export function useSidebarSavedState<T = number | boolean>(
  persistenceKey: string | undefined,
  subKey: string,
  defaultValue: T
) {
  const [state, setState] = React.useState<T>(() => readFromStore(persistenceKey, subKey, defaultValue));

  useEffect(() => {
    setState(readFromStore(persistenceKey, subKey, defaultValue));
    // Re-read from storage when the persistence key changes, but not when defaultValue changes
    // to avoid overriding a user-persisted value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistenceKey, subKey]);

  const setPersisted = useCallback(
    (cb: (prevState: T) => T) => {
      setState((prevState) => {
        const newState = cb(prevState);

        if (!persistenceKey) {
          return newState;
        }

        if (persistenceKey) {
          store.set(`grafana.ui.sidebar.${persistenceKey}.${subKey}`, String(newState));
        }

        return newState;
      });
    },
    [persistenceKey, subKey]
  );

  return [state, setPersisted] as const;
}
