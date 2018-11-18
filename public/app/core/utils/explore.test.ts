import { DEFAULT_RANGE, serializeStateToUrlParam, parseUrlState } from './explore';
import { ExploreState } from 'app/types/explore';

const DEFAULT_EXPLORE_STATE: ExploreState = {
  datasource: null,
  datasourceError: null,
  datasourceLoading: null,
  datasourceMissing: false,
  datasourceName: '',
  exploreDatasources: [],
  graphRange: DEFAULT_RANGE,
  history: [],
  queries: [],
  queryTransactions: [],
  range: DEFAULT_RANGE,
  showingGraph: true,
  showingLogs: true,
  showingTable: true,
  supportsGraph: null,
  supportsLogs: null,
  supportsTable: null,
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

    it('returns a valid Explore state from URL parameter', () => {
      const paramValue =
        '%7B"datasource":"Local","queries":%5B%7B"query":"metric"%7D%5D,"range":%7B"from":"now-1h","to":"now"%7D%7D';
      expect(parseUrlState(paramValue)).toMatchObject({
        datasource: 'Local',
        queries: [{ query: 'metric' }],
        range: {
          from: 'now-1h',
          to: 'now',
        },
      });
    });

    it('returns a valid Explore state from a compact URL parameter', () => {
      const paramValue = '%5B"now-1h","now","Local","metric"%5D';
      expect(parseUrlState(paramValue)).toMatchObject({
        datasource: 'Local',
        queries: [{ query: 'metric' }],
        range: {
          from: 'now-1h',
          to: 'now',
        },
      });
    });
  });

  describe('serializeStateToUrlParam', () => {
    it('returns url parameter value for a state object', () => {
      const state = {
        ...DEFAULT_EXPLORE_STATE,
        datasourceName: 'foo',
        range: {
          from: 'now-5h',
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
          '{"query":"super{foo=\\"x/z\\"}"}],"range":{"from":"now-5h","to":"now"}}'
      );
    });

    it('returns url parameter value for a state object', () => {
      const state = {
        ...DEFAULT_EXPLORE_STATE,
        datasourceName: 'foo',
        range: {
          from: 'now-5h',
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
      expect(serializeStateToUrlParam(state, true)).toBe(
        '["now-5h","now","foo","metric{test=\\"a/b\\"}","super{foo=\\"x/z\\"}"]'
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
