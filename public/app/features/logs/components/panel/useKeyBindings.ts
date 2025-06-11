import { useEffect } from 'react';

import { useLogListSearchContext } from './LogListSearchContext';

/**
 * Handles toggling of the search box of virtualized Logs Panel.
 * Mousetrap cannot be used because of the following issues:
 * - https://github.com/ccampbell/mousetrap/issues/442
 * - https://github.com/ccampbell/mousetrap/issues/162
 */

export const useKeyBindings = () => {
  const { hideSearch, searchVisible, showSearch } = useLogListSearchContext();

  useEffect(() => {
    function handleToggleSearch(event: KeyboardEvent) {
      const isMac = navigator.userAgent.includes('Mac');
      const isFKey = event.key === 'f' || event.key === 'F';

      if ((isMac && event.metaKey && isFKey) || (!isMac && event.ctrlKey && isFKey)) {
        showSearch();
        return;
      }
      if (event.key === 'Escape' && searchVisible) {
        hideSearch();
      }
    }
    document.addEventListener('keydown', handleToggleSearch);
    return () => {
      document.removeEventListener('keydown', handleToggleSearch);
    };
  });
};
