import { standardTransformersRegistry } from '@grafana/data';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { corpusCases } from './__corpus__/cases';
import { getPluginLoader } from './__corpus__/plugins';
import { renderReviewText } from './renderReviewText';
import { summarizeDashboardChanges } from './summarizeDashboardChanges';

// The app always has the transformer registry; transformations are named from it.
standardTransformersRegistry.setInit(getStandardTransformers);

describe('Review corpus', () => {
  it.each(corpusCases.map((corpusCase) => [corpusCase.name, corpusCase] as const))('%s', (_, { input, expected }) => {
    const { plugins, ...reviewInput } = input;
    const summary = summarizeDashboardChanges({ ...reviewInput, getPlugin: getPluginLoader(plugins) });

    expect(renderReviewText(summary)).toBe(expected);
  });
});
