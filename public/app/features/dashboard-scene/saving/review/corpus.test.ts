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
import { renderReviewText } from './__corpus__/renderReviewText';
import { emptyBaselineFor } from './describe/paths';
import { summarizeDashboardChanges } from './summarizeDashboardChanges';

// The app always has the transformer registry; transformations are named from it.
standardTransformersRegistry.setInit(getStandardTransformers);

describe('Review corpus', () => {
  describe.each(corpusCases.map((corpusCase) => [corpusCase.name, corpusCase] as const))(
    '%s',
    (_, { input, expected }) => {
      const { plugins, ...reviewInput } = input;
      const summarize = () => summarizeDashboardChanges({ ...reviewInput, getPlugin: getPluginLoader(plugins) });

      it('renders the expected text', () => {
        expect(renderReviewText(summarize())).toBe(expected);
      });

      it('claims every diff path exactly once, with no phantom claims', () => {
        const baseline = input.baseline ?? emptyBaselineFor(input.payload);
        const report = checkCompleteness(diffPathKeys(jsonDiff(baseline, input.payload)), collectClaims(summarize()));

        expect(formatCompletenessReport(report)).toBe('');
      });

      it('shows no raw spec paths', () => {
        expect(findRawPathTexts(collectTexts(summarize()))).toEqual([]);
      });
    }
  );
});
