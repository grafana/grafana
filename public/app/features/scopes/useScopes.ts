import { useEffect } from 'react';

import { scopesFiltersScene } from './instance';
import { disableScopes, enableScopes, getSelectedScopes, hideScopes, showScopes } from './utils';

export interface UseScopesOptions {
  // Prevent rendering the selector by default
  hidden?: boolean;
}

export const useScopes = ({ hidden }: UseScopesOptions = {}) => {
  // This is here to trigger a re-render when the scopes state changes
  scopesFiltersScene?.useState();

  useEffect(() => {
    if (!hidden) {
      showScopes();
    }

    return () => {
      hideScopes();
    };
  }, [hidden]);

  return {
    value: getSelectedScopes(),
    show: showScopes,
    hide: hideScopes,
    enable: enableScopes,
    disable: disableScopes,
  };
};
