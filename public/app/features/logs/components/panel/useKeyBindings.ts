import { useEffect } from 'react';

import { mousetrap } from 'app/core/services/mousetrap';

import { useLogListSearchContext } from './LogListSearchContext';

export const useKeyBindings = () => {
  const { hideSearch, searchVisible, showSearch } = useLogListSearchContext();

  useEffect(() => {
    mousetrap.bind(
      'esc',
      () => {
        if (searchVisible) {
          hideSearch();
        }
        return true;
      },
      'keydown'
    );

    mousetrap.bind(
      'ctrl+f',
      () => {
        showSearch();
        return true;
      },
      'keydown'
    );

    mousetrap.bind(
      'meta+f',
      () => {
        showSearch();
        return true;
      },
      'keydown'
    );

    return () => {
      mousetrap.unbind('ctrl+f', 'keydown');
      mousetrap.unbind('meta+f', 'keydown');
      mousetrap.unbind('esc', 'keydown');
    };
  });
};
