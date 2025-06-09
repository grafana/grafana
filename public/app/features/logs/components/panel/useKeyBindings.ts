import { useEffect } from 'react';

import { mousetrap } from 'app/core/services/mousetrap';

export const useKeyBindings = () => {
  useEffect(() => {
    mousetrap.bind(
      'ctrl+f',
      () => {
        console.log('search');
        return true;
      },
      'keydown'
    );

    mousetrap.bind(
      'meta+f',
      () => {
        console.log('search');
        return true;
      },
      'keydown'
    );

    return () => {
      mousetrap.unbind('ctrl+f', 'keydown');
      mousetrap.unbind('meta+f', 'keydown');
    };
  });
};
