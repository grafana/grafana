import { DEFAULT_RANGE } from 'app/features/explore/state/utils';

import { v0Migrator } from './v0';

describe('v0 migrator', () => {
  describe('parse', () => {
    beforeEach(function () {
      jest.spyOn(console, 'error').mockImplementation(() => void 0);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns default state on empty string', () => {
      expect(v0Migrator.parse({})).toMatchObject({
        left: {
          datasource: null,
          queries: [],
          range: DEFAULT_RANGE,
        },
      });
    });

    it('returns a valid Explore state from URL parameter', () => {
      const paramValue = '{"datasource":"Local","queries":[{"expr":"metric"}],"range":{"from":"now-1h","to":"now"}}';
      expect(v0Migrator.parse({ left: paramValue })).toMatchObject({
        left: {
          datasource: 'Local',
          queries: [{ expr: 'metric' }],
          range: {
            from: 'now-1h',
            to: 'now',
          },
        },
      });
    });

    it('returns a valid Explore state from right URL parameter', () => {
      const paramValue = '{"datasource":"Local","queries":[{"expr":"metric"}],"range":{"from":"now-1h","to":"now"}}';
      expect(v0Migrator.parse({ right: paramValue })).toMatchObject({
        right: {
          datasource: 'Local',
          queries: [{ expr: 'metric' }],
          range: {
            from: 'now-1h',
            to: 'now',
          },
        },
      });
    });

    it('returns a default state from invalid right URL parameter', () => {
      const paramValue = 10;
      expect(v0Migrator.parse({ right: paramValue })).toMatchObject({
        right: {
          datasource: null,
          queries: [],
          range: DEFAULT_RANGE,
        },
      });
    });

    it('returns a valid Explore state from a compact URL parameter', () => {
      const paramValue =
        '["now-1h","now","Local",{"expr":"metric"},{"ui":[true,true,true,"none"],"__panelsState":{"logs":"1"}}]';
      expect(v0Migrator.parse({ left: paramValue })).toMatchObject({
        left: {
          datasource: 'Local',
          queries: [{ expr: 'metric' }],
          range: {
            from: 'now-1h',
            to: 'now',
          },
          panelsState: {
            logs: '1',
          },
        },
      });
    });

    it('returns default state on compact URLs with too few segments ', () => {
      const paramValue = '["now-1h",{"expr":"metric"},{"ui":[true,true,true,"none"]}]';
      expect(v0Migrator.parse({ left: paramValue })).toMatchObject({
        left: {
          datasource: null,
          queries: [],
          range: DEFAULT_RANGE,
        },
      });
      expect(console.error).toHaveBeenCalledWith('Error parsing compact URL state for Explore.');
    });

    it('should not return a query for mode in the url', () => {
      // Previous versions of Grafana included "Explore mode" in the URL; this should not be treated as a query.
      const paramValue =
        '["now-1h","now","x-ray-datasource",{"queryType":"getTraceSummaries"},{"mode":"Metrics"},{"ui":[true,true,true,"none"]}]';
      expect(v0Migrator.parse({ left: paramValue })).toMatchObject({
        left: {
          datasource: 'x-ray-datasource',
          queries: [{ queryType: 'getTraceSummaries' }],
          range: {
            from: 'now-1h',
            to: 'now',
          },
        },
      });
    });

    it('should return queries if queryType is present in the url', () => {
      const paramValue =
        '["now-1h","now","x-ray-datasource",{"queryType":"getTraceSummaries"},{"ui":[true,true,true,"none"]}]';
      expect(v0Migrator.parse({ left: paramValue })).toMatchObject({
        left: {
          datasource: 'x-ray-datasource',
          queries: [{ queryType: 'getTraceSummaries' }],
          range: {
            from: 'now-1h',
            to: 'now',
          },
        },
      });
    });
  });
});
