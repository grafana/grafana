import { DEFAULT_RANGE, serializeStateToUrlParam, parseUrlState } from './explore';
import { ExploreState } from 'app/types/explore';

const DEFAULT_EXPLORE_STATE: ExploreState = {
  datasource: null,
  datasourceError: null,
  datasourceLoading: null,
  datasourceMissing: false,
  datasourceName: '',
  graphResult: null,
  history: [],
  latency: 0,
  loading: false,
  logsResult: null,
  queries: [],
  queryErrors: [],
  queryHints: [],
  range: DEFAULT_RANGE,
  requestOptions: null,
  showingGraph: true,
  showingLogs: true,
  showingTable: true,
  supportsGraph: null,
  supportsLogs: null,
  supportsTable: null,
  tableResult: null,
};

describe('state functions', () => {
  describe('parseUrlState', () => {
    it('returns default state on empty string', () => {
      expect(parseUrlState('')).toMatchObject({
        datasource: null,
        queries: [],
        range: DEFAULT_RANGE,
      });
    });
  });
  describe('serializeStateToUrlParam', () => {
    it('returns url parameter value for a state object', () => {
      const state = {
        ...DEFAULT_EXPLORE_STATE,
        datasourceName: 'foo',
        range: {
          from: 'now - 5h',
          to: 'now',
        },
        queries: [
          {
            query: 'metric{test="a/b"}',
          },
          {
            query: 'super{foo="x/z"}',
          },
        ],
      };
      expect(serializeStateToUrlParam(state)).toBe(
        '{"datasource":"foo","queries":[{"query":"metric{test=\\"a/b\\"}"},' +
        '{"query":"super{foo=\\"x/z\\"}"}],"range":{"from":"now - 5h","to":"now"}}'
      );
    });
  });
  describe('interplay', () => {
    it('can parse the serialized state into the original state', () => {
      const state = {
        ...DEFAULT_EXPLORE_STATE,
        datasourceName: 'foo',
        range: {
          from: 'now - 5h',
          to: 'now',
        },
        queries: [
          {
            query: 'metric{test="a/b"}',
          },
          {
            query: 'super{foo="x/z"}',
          },
        ],
      };
      const serialized = serializeStateToUrlParam(state);
      const parsed = parseUrlState(serialized);

      // Account for datasource vs datasourceName
      const { datasource, ...rest } = parsed;
      const sameState = {
        ...rest,
        datasource: DEFAULT_EXPLORE_STATE.datasource,
        datasourceName: datasource,
      };

      expect(state).toMatchObject(sameState);
    });
  });
});
