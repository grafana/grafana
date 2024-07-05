import { useEffect, useState } from 'react';

import { Scope } from '@grafana/data';

import { scopesScene } from './instance';

export interface UseScopesOptions {
  // A callback that will be executed when new scopes are set
  handler?: (scopes: Scope[]) => void;

  // Prevent rendering the selector by default
  hidden?: boolean;
}

export const useScopes = ({ handler, hidden }: UseScopesOptions = {}) => {
  const [value, setValue] = useState(scopesScene?.getSelectedScopes() ?? []);

  useEffect(() => {
    if (!hidden) {
      scopesScene?.show();
    }

    const sub = scopesScene?.subscribeToSelectedScopes((scopes) => {
      console.log('scopes', scopes);
      setValue(scopes);
      handler?.(scopes);
    });

    return () => {
      sub?.unsubscribe();

      scopesScene?.hide();
    };
  }, [handler, hidden, setValue]);

  return {
    value,
    show: () => scopesScene?.show(),
    hide: () => scopesScene?.hide(),
    enterViewMode: () => scopesScene?.enterViewMode(),
    exitViewMode: () => scopesScene?.exitViewMode(),
  };
};
