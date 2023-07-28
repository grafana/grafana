import { silenceConsoleOutput } from 'test/core/utils/silenceConsoleOutput';

import { toUtc } from '@grafana/data';
import { DEFAULT_RANGE } from 'app/features/explore/state/utils';

import { v1Migrator } from './v1';

jest.mock('app/core/utils/explore', () => ({
  ...jest.requireActual('app/core/utils/explore'),
  generateExploreId: () => 'ID',
}));

describe('v1 migrator', () => {
  describe('parse', () => {
    silenceConsoleOutput();

    it('correctly returns default state when no params are provided', () => {
      expect(v1Migrator.parse({})).toMatchObject({
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
      expect(v1Migrator.parse({ panes: '{}' })).toMatchObject({
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
      expect(v1Migrator.parse({ panes: '{a malformed json}' })).toMatchObject({
        panes: {
          ID: {
            datasource: null,
            queries: [],
            range: DEFAULT_RANGE,
          },
        },
      });

      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('correctly returns default state when a pane in panes params is an empty object', () => {
      expect(v1Migrator.parse({ panes: '{"aaa": {}}' })).toMatchObject({
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
      expect(v1Migrator.parse({ panes: '{"aaa": "NOT A VALID URL STATE"}' })).toMatchObject({
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
        })
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

    it('correctly parses absolute range', () => {
      const expectedTime = toUtc(946684800000);
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
                "from": "946684800000",
                "to": "946684800000"
              }
            }
          }`,
        })
      ).toMatchObject({
        panes: {
          aaa: {
            datasource: 'my-ds',
            queries: [{ refId: 'A' }],
            range: {
              from: expectedTime,
              to: expectedTime,
            },
          },
        },
      });
    });

    it('correctly sets default range when provided range is incorrect', () => {
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
                "from": "boom",
                "to": "now"
              }
            }
          }`,
        })
      ).toMatchObject({
        panes: {
          aaa: {
            datasource: 'my-ds',
            queries: [{ refId: 'A' }],
            range: {
              from: 'now-6h',
              to: 'now',
            },
          },
        },
      });
    });

    it('correctly sets default range when provided range is incomplete', () => {
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
                "from": "now-5h"
              }
            }
          }`,
        })
      ).toMatchObject({
        panes: {
          aaa: {
            datasource: 'my-ds',
            queries: [{ refId: 'A' }],
            range: {
              from: 'now-6h',
              to: 'now',
            },
          },
        },
      });
    });
  });

  describe('migrate', () => {
    // TODO: implement
  });
});
