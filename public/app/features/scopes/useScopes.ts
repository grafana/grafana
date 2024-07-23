import { useEffect, useState } from 'react';

import { scopesScene } from './instance';

export interface UseScopesOptions {
  // Prevent rendering the selector by default
  hidden?: boolean;
}

export const useScopes = ({ hidden }: UseScopesOptions = {}) => {
  const [value, setValue] = useState(scopesScene?.getSelectedScopes() ?? []);

  useEffect(() => {
    if (!hidden) {
      scopesScene?.show();
    }

    const sub = scopesScene?.subscribeToSelectedScopes((scopes) => {
      setValue(scopes);
    });

    return () => {
      sub?.unsubscribe();

      scopesScene?.hide();
    };
  }, [hidden, setValue]);

  return {
    value,
    show: () => scopesScene?.show(),
    hide: () => scopesScene?.hide(),
    disable: () => scopesScene?.disable(),
    enable: () => scopesScene?.enable(),
  };
};
