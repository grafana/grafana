import { memo, useLayoutEffect } from 'react';

import { useGrafana } from 'app/core/context/GrafanaContext';
import { isShallowEqual } from 'app/core/utils/isShallowEqual';

import { type SectionSidebarOverride } from './types';

/**
 * Lets a page pass context to its section sidebar, force a section, or opt out of one.
 * Pages whose nav matches a registered section get the sidebar without this.
 */
export const AppChromeSectionSidebar = memo(({ sectionId, disabled, context }: SectionSidebarOverride) => {
  const { chrome } = useGrafana();

  useLayoutEffect(() => {
    return () => {
      chrome.update({ sectionSidebarOverride: undefined });
    };
  }, [chrome]);

  useLayoutEffect(() => {
    const current = chrome.state.getValue().sectionSidebarOverride;
    // Pages usually pass a fresh context object on every render, so compare by value
    if (
      current?.sectionId === sectionId &&
      current?.disabled === disabled &&
      isShallowEqual(current?.context ?? {}, context ?? {})
    ) {
      return;
    }
    chrome.update({ sectionSidebarOverride: { sectionId, disabled, context } });
  });

  return null;
});

AppChromeSectionSidebar.displayName = 'AppChromeSectionSidebar';
