import { getNumCharsToDelete } from './suggestions';

describe('suggestions', () => {
  describe('getNumCharsToDelete', () => {
    describe('when slateAutocomplete is enabled', () => {
      let originalBootData = window.grafanaBootData;

      // hacky way to enable the feature toggle for this test
      beforeEach(() => {
        if (originalBootData) {
          window.grafanaBootData = {
            ...originalBootData,
            settings: {
              ...originalBootData.settings,
              featureToggles: {
                ...originalBootData.settings.featureToggles,
                slateAutocomplete: true,
              },
            },
          };
        }
      });

      afterEach(() => {
        window.grafanaBootData = originalBootData;
      });

      const splunkCleanText = (s: string) => s.replace(/[{}[\]="(),!~+\-*/^%:\\]/g, '').trim();
      it.each([
        // | represents the caret position
        ['$query0 ', '', '', false, 0, undefined, { forward: 0, backward: 0 }], // "|" --> "$query0 |"
        ['$query0 ', '$que', '$que', false, 0, undefined, { forward: 0, backward: 4 }], // "$que|" --> "$query0 |"
        ['$query0 ', '$q', '$que', false, 0, undefined, { forward: 2, backward: 2 }], // "$q|ue" --> "$query0 |"
        ['$query0 ', '$que', '($que)', false, 0, splunkCleanText, { forward: 0, backward: 4 }], // "($que|)" --> "($query0 |)"
        ['$query0 ', '$que', 'esarvotionUsagePercent=$que', false, 0, undefined, { forward: 0, backward: 4 }], // "esarvotionUsagePercent=$que|" --> "esarvotionUsagePercent=$query0 |"
      ])(
        'should calculate the correct number of characters to delete forwards and backwards',
        (suggestionText, typeaheadPrefix, typeaheadText, preserveSuffix, deleteBackwards, cleanText, expected) => {
          expect(
            getNumCharsToDelete(
              suggestionText,
              typeaheadPrefix,
              typeaheadText,
              preserveSuffix,
              deleteBackwards,
              cleanText
            )
          ).toEqual(expected);
        }
      );
    });
  });
});
