import { useMemo, useState } from 'react';
import { useDebounce } from 'react-use';

import { useFlagGrafanaSectionSidebar } from '@grafana/runtime/internal';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { type AppChromeState } from '../AppChromeService';

import { getSectionSidebarById, getSectionSidebarForNavId, useSectionSidebarDefinitions } from './registry';
import { type SectionSidebarContext, type SectionSidebarDefinition } from './types';

export const SECTION_SIDEBAR_WIDTH = 256;

export interface ActiveSectionSidebar {
  definition: SectionSidebarDefinition;
  context: SectionSidebarContext;
}

export function useActiveSectionSidebar(state: AppChromeState): ActiveSectionSidebar | undefined {
  const enabled = useFlagGrafanaSectionSidebar();
  const isLargeScreen = useMediaQueryMinWidth('xl');
  // Subscribing re-renders the chrome when a section registers after first render
  const definitions = useSectionSidebarDefinitions();
  const override = state.sectionSidebarOverride;
  const navId = state.sectionNav.main.id;

  return useMemo(() => {
    if (!enabled || !isLargeScreen || state.chromeless || override?.disabled) {
      return undefined;
    }

    const definition = override?.sectionId
      ? getSectionSidebarById(override.sectionId)
      : getSectionSidebarForNavId(navId);

    if (!definition) {
      return undefined;
    }

    return { definition, context: { sectionId: definition.id, pageContext: override?.context ?? {} } };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- definitions only signals registry changes
  }, [enabled, isLargeScreen, state.chromeless, override, navId, definitions]);
}

/**
 * The sidebar sits right of the docked mega menu (full width or rail) and the scopes panel.
 * `left` alone is the content offset when there is no section sidebar.
 */
export function getSectionSidebarOffsets({
  menuWidth,
  scopesWidth,
  menuDocked,
  scopesOpen,
}: {
  menuWidth: number;
  scopesWidth: number;
  menuDocked: boolean;
  scopesOpen: boolean;
}) {
  const left = (menuDocked ? menuWidth : 0) + (scopesOpen ? scopesWidth : 0);
  const width = SECTION_SIDEBAR_WIDTH;
  return { left, width, contentPaddingLeft: left + width };
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useDebounce(() => setDebounced(value), delay, [value]);
  return debounced;
}
