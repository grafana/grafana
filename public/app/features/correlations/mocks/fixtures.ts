import { Correlation } from '@grafana/api-clients/rtkq/correlations/v0alpha1';

import { fakeCorrelations, generateCorrMetadata } from './server/correlations.scenario';

export const setupMockCorrelations = () => {
  mockCorrelationsMap.clear();
};

export let mockCorrelationsMap = new Map<string, Correlation>();

export const resetFixtures = () => {
  setupMockCorrelations();
};

export const prePopulateCorrelations = () => {
  fakeCorrelations.forEach((fakeCorr, i) => {
    mockCorrelationsMap.set(i.toString(), generateCorrMetadata(i.toString(), fakeCorr));
  });
};
