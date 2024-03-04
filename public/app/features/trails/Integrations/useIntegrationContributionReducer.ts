import { useReducer } from 'react';

import { IntegrationContribution } from './types';

export function useIntegrationContributionReducer<T extends IntegrationContribution>() {
  return useReducer((contributions: T[], newContribution: T) => {
    const alreadyContributed = contributions.find((contrib) => contrib.id === newContribution.id);
    if (alreadyContributed) {
      return contributions;
    }
    return [...contributions, newContribution];
  }, []);
}
