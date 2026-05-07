import { useEffect } from 'react';

import { useLogDetailsContext } from './LogDetailsContext';
import { useLogListSearchContext } from './LogListSearchContext';

/**
 * Handles toggling of the search box of virtualized Logs Panel.
 * Mousetrap cannot be used because of the following issues:
 * - https://github.com/ccampbell/mousetrap/issues/442
 * - https://github.com/ccampbell/mousetrap/issues/162
 */

export const useKeyBindings = () => {
  const { hideSearch, searchVisible, showSearch } = useLogListSearchContext();
  const { showDetails, detailsMode, closeDetails } = useLogDetailsContext();

  useEffect(() => {
    function handleOpenSearch(event: KeyboardEvent) {
      const isMac = navigator.userAgent.includes('Mac');
      const isFKey = event.key === 'f' || event.key === 'F';

      if ((isMac && event.metaKey && isFKey) || (!isMac && event.ctrlKey && isFKey)) {
        showSearch();
        return;
      }
    }
    function handleClose(event: KeyboardEvent) {
      if (event.key === 'Escape' && searchVisible) {
        hideSearch();
      }
      if (event.key === 'Escape' && showDetails.length > 0 && detailsMode === 'sidebar') {
        closeDetails();
      }
    }
    document.addEventListener('keydown', handleOpenSearch);
    document.addEventListener('keyup', handleClose);
    return () => {
      document.removeEventListener('keydown', handleOpenSearch);
      document.removeEventListener('keyup', handleClose);
    };
  }, [closeDetails, detailsMode, hideSearch, searchVisible, showDetails.length, showSearch]);
};
