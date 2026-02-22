import { DEFAULT_RANGE } from 'app/features/explore/state/constants';

import { v1Migrator } from './v1';

// Avoids errors caused by circular dependencies
jest.mock('app/features/live/dashboard/dashboardWatcher', () => ({
  ignoreNextSave: jest.fn(),
}));

jest.mock('app/core/utils/explore', () => ({
  ...jest.requireActual('app/core/utils/explore'),
  generateExploreId: () => 'ID',
}));

describe('v1 migrator', () => {
  describe('parse', () => {
    it('correctly returns default state when no params are provided', () => {
      expect(v1Migrator.parse({}).to).toMatchObject({
        panes: {
          ID: {
            datasource: null,
            queries: [],
            range: DEFAULT_RANGE,
          },
        },
      });
    });

    it('correctly returns default state when panes param is an empty object', () => {
      expect(v1Migrator.parse({ panes: '{}' }).to).toMatchObject({
        panes: {
          ID: {
            datasource: null,
            queries: [],
            range: DEFAULT_RANGE,
          },
        },
      });
    });

    it('correctly returns default state when panes param is not a valid JSON object', () => {
      expect(v1Migrator.parse({ panes: '{a malformed json}' }).to).toMatchObject({
        panes: {
          ID: {
            datasource: null,
            queries: [],
            range: DEFAULT_RANGE,
          },
        },
      });
    });

    it('correctly returns default state when a pane in panes params is an empty object', () => {
      expect(v1Migrator.parse({ panes: '{"aaa": {}}' }).to).toMatchObject({
        panes: {
          aaa: {
            datasource: null,
            queries: [],
            range: DEFAULT_RANGE,
          },
        },
      });
    });

    it('correctly returns default state when a pane in panes params is not a valid JSON object', () => {
      expect(v1Migrator.parse({ panes: '{"aaa": "NOT A VALID URL STATE"}' }).to).toMatchObject({
        panes: {
          aaa: {
            datasource: null,
            queries: [],
            range: DEFAULT_RANGE,
          },
        },
      });
    });

    it('correctly parses state', () => {
      expect(
        v1Migrator.parse({
          panes: `{
            "aaa": {
              "datasource": "my-ds",
              "queries": [
                {
                  "refId": "A"
                }
              ],
              "range": {
                "from": "now",
                "to": "now-5m"
              }
            }
          }`,
        }).to
      ).toMatchObject({
        panes: {
          aaa: {
            datasource: 'my-ds',
            queries: [{ refId: 'A' }],
            range: {
              from: 'now',
              to: 'now-5m',
            },
          },
        },
      });
    });

    it('correctly parses state with variables', () => {
      const result = v1Migrator.parse({
        panes: JSON.stringify({
          aaa: {
            datasource: 'my-ds',
            queries: [{ refId: 'A' }],
            range: { from: 'now-1h', to: 'now' },
            variables: [
              { name: 'job', query: 'demo,node', value: 'demo', text: 'demo' },
              { name: 'env', query: 'dev,prod', isMulti: true, includeAll: true },
            ],
          },
        }),
      }).to;

      expect(result.panes.aaa.variables).toHaveLength(2);
      expect(result.panes.aaa.variables?.[0]).toMatchObject({ name: 'job', query: 'demo,node' });
      expect(result.panes.aaa.variables?.[1]).toMatchObject({ name: 'env', isMulti: true, includeAll: true });
    });

    it('does not include variables when not present in URL', () => {
      const result = v1Migrator.parse({
        panes: JSON.stringify({
          aaa: {
            datasource: 'my-ds',
            queries: [],
            range: { from: 'now-1h', to: 'now' },
          },
        }),
      }).to;

      expect(result.panes.aaa.variables).toBeUndefined();
    });

    it('filters out malformed variable entries', () => {
      const result = v1Migrator.parse({
        panes: JSON.stringify({
          aaa: {
            datasource: 'my-ds',
            queries: [],
            range: { from: 'now-1h', to: 'now' },
            variables: [
              { name: 'valid', query: 'a,b' },
              { query: 'missing-name' },
              { name: '', query: 'empty-name' },
              { name: 123, query: 'numeric-name' },
              'not-an-object',
            ],
          },
        }),
      }).to;

      expect(result.panes.aaa.variables).toHaveLength(1);
      expect(result.panes.aaa.variables?.[0]).toMatchObject({ name: 'valid' });
    });

    it('handles variables field that is not an array gracefully', () => {
      const result = v1Migrator.parse({
        panes: JSON.stringify({
          aaa: {
            datasource: 'my-ds',
            queries: [],
            range: { from: 'now-1h', to: 'now' },
            variables: 'not-an-array',
          },
        }),
      }).to;

      expect(result.panes.aaa.variables).toBeUndefined();
    });
  });

  describe('migrate', () => {
    // TODO: implement
  });
});
