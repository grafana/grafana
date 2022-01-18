import MonacoMock from '../../__mocks__/cloudwatch-sql/Monaco';
import { MetricMathCompletionItemProvider } from './CompletionItemProvider';
import { getTemplateSrv } from '@grafana/runtime';
import { MetricMathTokenType } from './types';
import { getStatementPosition } from './statementPosition';
import { getSuggestionKinds } from './suggestionKind';
import { CloudWatchDatasource } from '../../datasource';
import cloudWatchMetricMathLanguageDefinition from '../definition';
import { Monaco, monacoTypes } from '@grafana/ui';
import { IPosition } from 'monaco-editor';
import { METRIC_MATH_FNS, METRIC_MATH_KEYWORDS, METRIC_MATH_OPERATORS } from '../language';
import { LinkedToken } from '../../monarch/LinkedToken';

const getSuggestions = async (mockToken: LinkedToken | null) => {
  const setup = new MetricMathCompletionItemProvider(
    ({
      getVariables: () => [],
      getActualRegion: () => 'us-east-2',
    } as any) as CloudWatchDatasource,
    getTemplateSrv(),
    cloudWatchMetricMathLanguageDefinition,
    MetricMathTokenType,
    () => getStatementPosition(mockToken),
    getSuggestionKinds
  );
  const monaco = MonacoMock as Monaco;
  const provider = setup.getCompletionProvider(monaco);
  const { suggestions } = await provider.provideCompletionItems(
    ({ getValue: () => null } as any) as monacoTypes.editor.ITextModel,
    {} as IPosition
  );
  return suggestions;
};
describe('MetricMath: CompletionItemProvider', () => {
  describe('getSuggestions', () => {
    it('returns a suggestion for every metric math function when passed a null token', async () => {
      const mockToken = null;
      const suggestions = await getSuggestions(mockToken);
      expect(suggestions.length).toEqual(METRIC_MATH_FNS.length);
    });

    it('returns a suggestion for every metric math operator when at the end of a function', async () => {
      const previousLinkedToken = new LinkedToken(
        MetricMathTokenType.String,
        ')',
        makeMockRange(),
        null,
        null,
        MetricMathTokenType
      );
      const mockLinkedToken = new LinkedToken(
        MetricMathTokenType.Whitespace,
        ' ',
        makeMockRange(),
        previousLinkedToken,
        null,
        MetricMathTokenType
      );
      const suggestions = await getSuggestions(mockLinkedToken);
      expect(suggestions.length).toEqual(METRIC_MATH_OPERATORS.length);
    });

    it('returns a suggestion for every metric math function and keyword if at the start of the second argument of a function', async () => {
      const previousLinkedToken = new LinkedToken(
        MetricMathTokenType.Delimiter,
        ',',
        makeMockRange(),
        null,
        null,
        MetricMathTokenType
      );
      const mockLinkedToken = new LinkedToken(
        MetricMathTokenType.Whitespace,
        ' ',
        makeMockRange(),
        previousLinkedToken,
        null,
        MetricMathTokenType
      );
      const suggestions = await getSuggestions(mockLinkedToken);
      expect(suggestions.length).toEqual(METRIC_MATH_FNS.length + METRIC_MATH_KEYWORDS.length);
    });

    it('does not have any particular suggestions if within a string', async () => {
      const previousLinkedToken = new LinkedToken(
        MetricMathTokenType.Delimiter,
        '(',
        makeMockRange(),
        null,
        null,
        MetricMathTokenType
      );
      const mockLinkedToken = new LinkedToken(
        MetricMathTokenType.String,
        '"somestring"',
        makeMockRange(),
        previousLinkedToken,
        null,
        MetricMathTokenType
      );
      const suggestions = await getSuggestions(mockLinkedToken);
      expect(suggestions.length).toEqual(0);
    });
  });
});

const makeMockRange = () => ({
  startLineNumber: 0,
  startColumn: 0,
  endLineNumber: 0,
  endColumn: 0,
});
