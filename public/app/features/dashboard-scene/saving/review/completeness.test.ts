import { standardTransformersRegistry } from '@grafana/data';
import { getStandardTransformers } from 'app/features/transformers/standardTransformers';

import { jsonDiff } from '../../settings/version-history/utils';

import { corpusCases } from './__corpus__/cases';
import {
  checkCompleteness,
  collectClaims,
  collectTexts,
  diffPathKeys,
  findRawPathTexts,
  formatCompletenessReport,
} from './__corpus__/completeness';
import { getPluginLoader } from './__corpus__/plugins';
import { emptyBaselineFor } from './describe/emptyBaseline';
import { summarizeDashboardChanges } from './summarizeDashboardChanges';

standardTransformersRegistry.setInit(getStandardTransformers);

describe('Review completeness over the corpus', () => {
  describe.each(corpusCases.map((corpusCase) => [corpusCase.name, corpusCase] as const))('%s', (_, { input }) => {
    const { plugins, ...reviewInput } = input;
    const summarize = () => summarizeDashboardChanges({ ...reviewInput, getPlugin: getPluginLoader(plugins) });

    it('claims every diff path exactly once, with no phantom claims', () => {
      const baseline = input.baseline ?? emptyBaselineFor(input.payload);
      const report = checkCompleteness(diffPathKeys(jsonDiff(baseline, input.payload)), collectClaims(summarize()));

      expect(formatCompletenessReport(report)).toBe('');
    });

    it('shows no raw spec paths', () => {
      expect(findRawPathTexts(collectTexts(summarize()))).toEqual([]);
    });
  });
});
