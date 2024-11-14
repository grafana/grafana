import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { AdHocFiltersVariable, sceneGraph, sceneUtils } from '@grafana/scenes';
import { DataSourceType } from 'app/features/alerting/unified/utils/datasource';

import { MockDataSourceSrv, mockDataSource } from '../../alerting/unified/mocks';
import { DataTrail } from '../DataTrail';
import { TRAIL_BOOKMARKS_KEY, RECENT_TRAILS_KEY, VAR_FILTERS } from '../shared';

import { SerializedTrail, getTrailStore } from './TrailStore';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    getAdhocFilters: jest.fn().mockReturnValue([{ key: 'origKey', operator: '=', value: '' }]),
  }),
}));

describe('TrailStore', () => {
  beforeAll(() => {
    jest.spyOn(DataTrail.prototype, 'checkDataSourceForOTelResources').mockImplementation(() => Promise.resolve());

    let localStore: Record<string, string> = {};

    const localStorageMock = {
      getItem: jest.fn((key) => (key in localStore ? localStore[key] : null)),
      setItem: jest.fn(jest.fn((key, value) => (localStore[key] = value + ''))),
      clear: jest.fn(() => (localStore = {})),
    };
    global.localStorage = localStorageMock as unknown as Storage;

    jest.useFakeTimers();

    // Having the mock service set up is required for activating the loaded trails
    setDataSourceSrv(
      new MockDataSourceSrv({
        prom: mockDataSource({
          name: 'Prometheus',
          type: DataSourceType.Prometheus,
          uid: 'ds',
        }),
      })
    );
  });

  describe('Empty store', () => {
    const store = getTrailStore();

    it('should have no recent trails', () => {
      expect(store.recent.length).toBe(0);
    });

    it('should have no bookmarked trails', () => {
      expect(store.bookmarks.length).toBe(0);
    });
  });

  describe('Initialize store with one recent trail with final current step', () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const history: SerializedTrail['history'] = [
      {
        urlValues: {
          from: 'now-1h',
          to: 'now',
          timezone,
          'var-ds': 'cb3a3391-700f-4cc6-81be-a122488e93e6',
          'var-filters': [],
          refresh: '',
        },
        type: 'start',
        description: 'Test',
        parentIndex: -1,
      },
      {
        urlValues: {
          metric: 'access_permissions_duration_count',
          from: 'now-1h',
          to: 'now',
          timezone,
          'var-ds': 'cb3a3391-700f-4cc6-81be-a122488e93e6',
          'var-filters': [],
          refresh: '',
        },
        type: 'metric',
        description: 'Test',
        parentIndex: 0,
      },
    ];

    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem(RECENT_TRAILS_KEY, JSON.stringify([{ history }]));
      getTrailStore().load();
    });

    it('should accurately load recent trails', () => {
      const store = getTrailStore();
      expect(store.recent.length).toBe(1);
      const trail = store.recent[0].resolve();
      expect(trail.state.history.state.steps.length).toBe(2);
      expect(trail.state.history.state.steps[0].type).toBe('start');
      expect(trail.state.history.state.steps[1].type).toBe('metric');
    });

    it('should have no bookmarked trails', () => {
      const store = getTrailStore();
      expect(store.bookmarks.length).toBe(0);
    });

    describe('Add a new recent trail with equivalent current step state', () => {
      const store = getTrailStore();

      const duplicateTrailSerialized: SerializedTrail = {
        history: [
          history[0],
          history[1],
          {
            ...history[1],
            urlValues: {
              ...history[1].urlValues,
              metric: 'different_metric_in_the_middle',
            },
          },
          {
            ...history[1],
          },
        ],
        currentStep: 3,
      };

      beforeEach(() => {
        // We expect the initialized trail to be there
        expect(store.recent.length).toBe(1);
        expect(store.recent[0].resolve().state.history.state.steps.length).toBe(2);

        // @ts-ignore #2341 -- deliberately access private method to construct trail object for testing purposes
        const duplicateTrail = store._deserializeTrail(duplicateTrailSerialized);
        store.setRecentTrail(duplicateTrail);
      });

      it('should still be only one recent trail', () => {
        expect(store.recent.length).toBe(1);
      });

      it('it should only contain the new trail', () => {
        const newRecentTrail = store.recent[0].resolve();
        expect(newRecentTrail.state.history.state.steps.length).toBe(duplicateTrailSerialized.history.length);

        // @ts-ignore #2341 -- deliberately access private method to construct trail object for testing purposes
        const newRecent = store._serializeTrail(newRecentTrail);
        expect(newRecent.currentStep).toBe(duplicateTrailSerialized.currentStep);
        expect(newRecent.history.length).toBe(duplicateTrailSerialized.history.length);
      });
    });

    it.each([
      ['metric', 'different_metric'],
      ['from', 'now-1y'],
      ['to', 'now-30m'],
      ['timezone', 'utc'],
      ['var-ds', 'ds'],
      ['var-groupby', 'job'],
      ['var-filters', 'cluster|=|dev-eu-west-2'],
    ])(`new recent trails with a different '%p' value should insert new entry`, (key, differentValue) => {
      const store = getTrailStore();
      // We expect the initialized trail to be there
      expect(store.recent.length).toBe(1);

      const differentTrailSerialized: SerializedTrail = {
        history: [
          history[0],
          history[1],
          {
            ...history[1],
            urlValues: {
              ...history[1].urlValues,
              [key]: differentValue,
            },
            parentIndex: 1,
          },
        ],
        currentStep: 2,
      };

      // @ts-ignore #2341 -- deliberately access private method to construct trail object for testing purposes
      const differentTrail = store._deserializeTrail(differentTrailSerialized);
      store.setRecentTrail(differentTrail);

      // There should now be two trails
      expect(store.recent.length).toBe(2);
    });

    test('deserializeTrail must show state of current step when not last step', () => {
      const trailSerialized: SerializedTrail = {
        history: [
          history[0],
          history[1],
          {
            ...history[1],
            urlValues: {
              ...history[1].urlValues,
              metric: 'something_else',
            },
            parentIndex: 1,
          },
        ],
        currentStep: 1,
      };

      // @ts-ignore #2341 -- deliberately access private method to construct trail object for testing purposes
      const trail = getTrailStore()._deserializeTrail(trailSerialized);

      //
      expect(trail.state.metric).not.toEqual('something_else');
      expect(trail.state.metric).toEqual(history[1].urlValues.metric);
    });
  });

  describe('Initialize store with one recent trail with non final current step', () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const history: SerializedTrail['history'] = [
      {
        urlValues: {
          from: 'now-1h',
          to: 'now',
          timezone,
          'var-ds': 'ds',
          'var-filters': [],
          refresh: '',
        },
        type: 'start',
        description: 'Test',
        parentIndex: -1,
      },
      {
        urlValues: {
          metric: 'current_metric',
          from: 'now-1h',
          to: 'now',
          timezone,
          'var-ds': 'ds',
          'var-filters': [],
          refresh: '',
        },
        type: 'metric',
        description: 'Test',
        parentIndex: 0,
      },
      {
        urlValues: {
          metric: 'final_metric',
          from: 'now-1h',
          to: 'now',
          timezone,
          'var-ds': 'ds',
          'var-filters': [],
          refresh: '',
        },
        type: 'metric',
        description: 'Test',
        parentIndex: 1,
      },
    ];

    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem(RECENT_TRAILS_KEY, JSON.stringify([{ history, currentStep: 1 }]));
      getTrailStore().load();
    });

    it('should accurately load recent trails', () => {
      const store = getTrailStore();
      expect(store.recent.length).toBe(1);
      const trail = store.recent[0].resolve();
      expect(trail.state.history.state.steps.length).toBe(3);
      expect(trail.state.history.state.steps[0].type).toBe('start');
      expect(trail.state.history.state.steps[1].type).toBe('metric');
      expect(trail.state.history.state.steps[1].trailState.metric).toBe('current_metric');
      expect(trail.state.history.state.steps[2].type).toBe('metric');
      expect(trail.state.history.state.steps[2].trailState.metric).toBe('final_metric');
      expect(trail.state.history.state.currentStep).toBe(1);
    });

    function getFilterVar(trail: DataTrail) {
      const variable = sceneGraph.lookupVariable(VAR_FILTERS, trail);
      if (variable instanceof AdHocFiltersVariable) {
        return variable;
      }
      throw new Error('getFilterVar failed');
    }

    function getStepFilterVar(trail: DataTrail, step: number) {
      const variable = trail.state.history.state.steps[step].trailState.$variables?.getByName(VAR_FILTERS);
      if (variable instanceof AdHocFiltersVariable) {
        return variable;
      }
      throw new Error(`getStepFilterVar failed for step ${step}`);
    }

    it('Recent trail filter should be empty at current step 1', () => {
      const store = getTrailStore();
      const trail = store.recent[0].resolve();

      expect(getStepFilterVar(trail, 1).state.filters.length).toBe(0);
      expect(trail.state.history.state.currentStep).toBe(1);
      expect(trail.state.history.state.steps.length).toBe(3);
    });

    describe('And filter is added zone=a', () => {
      let trail: DataTrail;
      beforeEach(() => {
        localStorage.clear();
        localStorage.setItem(RECENT_TRAILS_KEY, JSON.stringify([{ history, currentStep: 1 }]));
        getTrailStore().load();
        const store = getTrailStore();
        trail = store.recent[0].resolve();
        const urlState = sceneUtils.getUrlState(trail);
        locationService.partial(urlState);
        trail.activate();
        trail.state.history.activate();
        getFilterVar(trail).setState({ filters: [{ key: 'zone', operator: '=', value: 'a' }] });
      });

      it('This should create step 3', () => {
        expect(trail.state.history.state.steps.length).toBe(4);
        expect(trail.state.history.state.currentStep).toBe(3);
      });

      it('Filter of trail should be zone=a', () => {
        expect(getFilterVar(trail).state.filters[0].key).toBe('zone');
        expect(getFilterVar(trail).state.filters[0].value).toBe('a');
      });

      it('Filter of step 3 should be zone=a', () => {
        expect(getStepFilterVar(trail, 3).state.filters[0].key).toBe('zone');
        expect(getStepFilterVar(trail, 3).state.filters[0].value).toBe('a');
      });

      it('Filter of step 1 should be empty', () => {
        expect(getStepFilterVar(trail, 1).state.filters.length).toBe(0);
      });

      describe('When returning to step 1', () => {
        beforeEach(() => {
          trail.state.history.goBackToStep(1);
        });

        it('Filter of trail should be empty', () => {
          expect(getFilterVar(trail).state.filters.length).toBe(0);
        });
      });
    });

    it('Time range `from` should be now-1h', () => {
      const store = getTrailStore();
      const trail = store.recent[0].resolve();

      expect(trail.state.$timeRange?.state.from).toBe('now-1h');
    });

    describe('And time range is changed to now-15m to now', () => {
      let trail: DataTrail;

      beforeEach(() => {
        localStorage.clear();
        localStorage.setItem(RECENT_TRAILS_KEY, JSON.stringify([{ history, currentStep: 1 }]));
        getTrailStore().load();
        const store = getTrailStore();
        trail = store.recent[0].resolve();
        const urlState = sceneUtils.getUrlState(trail);
        locationService.partial(urlState);

        trail.activate();
        trail.state.history.activate();
        trail.state.$timeRange?.setState({ from: 'now-15m' });
      });

      it('This should create step 3', () => {
        expect(trail.state.history.state.steps.length).toBe(4);
        expect(trail.state.history.state.currentStep).toBe(3);
      });

      it('Time range `from` should be now-15m', () => {
        expect(trail.state.$timeRange?.state.from).toBe('now-15m');
      });

      it('Time range `from` of step 2 should be now-15m', () => {
        expect(trail.state.history.state.steps[3].trailState.$timeRange?.state.from).toBe('now-15m');
      });

      it('Time range `from` of step 1 should be now-1h', () => {
        expect(trail.state.history.state.steps[1].trailState.$timeRange?.state.from).toBe('now-1h');
      });

      describe('When returning to step 1', () => {
        beforeEach(() => {
          trail.state.history.goBackToStep(1);
        });

        it('Time range `from` should be now-1h', () => {
          expect(trail.state.$timeRange?.state.from).toBe('now-1h');
        });
      });
    });

    it('should have no bookmarked trails', () => {
      const store = getTrailStore();
      expect(store.bookmarks.length).toBe(0);
    });

    describe('Add a new recent trail with equivalent current step state', () => {
      const store = getTrailStore();

      const duplicateTrailSerialized: SerializedTrail = {
        history: [
          history[0],
          history[1],
          history[2],
          {
            ...history[2],
            urlValues: {
              ...history[1].urlValues,
              metric: 'different_metric_in_the_middle',
            },
          },
          {
            ...history[1],
          },
        ],
        currentStep: 4,
      };

      beforeEach(() => {
        // We expect the initialized trail to be there
        expect(store.recent.length).toBe(1);
        expect(store.recent[0].resolve().state.history.state.steps.length).toBe(3);

        // @ts-ignore #2341 -- deliberately access private method to construct trail object for testing purposes
        const duplicateTrail = store._deserializeTrail(duplicateTrailSerialized);
        store.setRecentTrail(duplicateTrail);
      });

      it('should still be only one recent trail', () => {
        expect(store.recent.length).toBe(1);
      });

      it('it should only contain the new trail', () => {
        const newRecentTrail = store.recent[0].resolve();
        expect(newRecentTrail.state.history.state.steps.length).toBe(duplicateTrailSerialized.history.length);

        // @ts-ignore #2341 -- deliberately access private method to construct trail object for testing purposes
        const newRecent = store._serializeTrail(newRecentTrail);
        expect(newRecent.currentStep).toBe(duplicateTrailSerialized.currentStep);
        expect(newRecent.history.length).toBe(duplicateTrailSerialized.history.length);
      });
    });

    it.each([
      ['metric', 'different_metric'],
      ['from', 'now-1y'],
      ['to', 'now-30m'],
      ['timezone', 'utc'],
      ['var-ds', 'different'],
      ['var-groupby', 'job'],
      ['var-filters', 'cluster|=|dev-eu-west-2'],
    ])(`new recent trails with a different '%p' value should insert new entry`, (key, differentValue) => {
      const store = getTrailStore();
      // We expect the initialized trail to be there
      expect(store.recent.length).toBe(1);

      const differentTrailSerialized: SerializedTrail = {
        history: [
          history[0],
          history[1],
          history[2],
          {
            ...history[2],
            urlValues: {
              ...history[1].urlValues,
              [key]: differentValue,
            },
            parentIndex: 1,
          },
        ],
        currentStep: 3,
      };

      // @ts-ignore #2341 -- deliberately access private method to construct trail object for testing purposes
      const differentTrail = store._deserializeTrail(differentTrailSerialized);
      store.setRecentTrail(differentTrail);

      // There should now be two trails
      expect(store.recent.length).toBe(2);
    });
  });

  describe('Initialize store with one bookmark trail but no recent trails', () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem(
        TRAIL_BOOKMARKS_KEY,
        JSON.stringify([
          {
            urlValues: {
              metric: 'bookmarked_metric',
              from: 'now-1h',
              to: 'now',
              timezone,
              'var-ds': 'prom-mock',
              'var-deployment_environment': ['undefined'],
              'var-otel_resources': [''],
              'var-filters': [],
              refresh: '',
            },
            type: 'time',
          },
        ])
      );
      getTrailStore().load();
    });

    const store = getTrailStore();

    it('should have no recent trails', () => {
      expect(store.recent.length).toBe(0);
    });

    it('should accurately load bookmarked trails xx', () => {
      expect(store.bookmarks.length).toBe(1);
      const trail = store.getTrailForBookmarkIndex(0);
      expect(trail.state.metric).toBe('bookmarked_metric');
    });

    it('should save a new recent trail based on the bookmark', () => {
      expect(store.recent.length).toBe(0);
      const trail = store.getTrailForBookmarkIndex(0);
      // Trail and history must be activated first
      trail.activate();
      trail.state.history.activate();
      store.setRecentTrail(trail);
      expect(store.recent.length).toBe(1);
    });

    it('should be able to obtain index of bookmark', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(0);
    });

    it('index should be undefined for removed bookmarks', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      store.removeBookmark(0);
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(undefined);
    });

    it('index should be undefined for a trail that has changed since it was bookmarked', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      trail.setState({ metric: 'something_completely_different' });
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(undefined);
    });

    it('should be able to obtain index of a bookmark for a trail that changed back to bookmarked state', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      const bookmarkedMetric = trail.state.metric;
      trail.setState({ metric: 'something_completely_different' });
      trail.setState({ metric: bookmarkedMetric });
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(0);
    });

    it('should remove a bookmark', () => {
      expect(store.bookmarks.length).toBe(1);
      store.removeBookmark(0);
      expect(store.bookmarks.length).toBe(0);

      jest.advanceTimersByTime(2000);

      expect(localStorage.getItem(TRAIL_BOOKMARKS_KEY)).toBe('[]');
    });
  });

  describe('Initialize store with one legacy bookmark trail', () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem(
        TRAIL_BOOKMARKS_KEY,
        JSON.stringify([
          {
            history: [
              {
                urlValues: {
                  from: 'now-1h',
                  to: 'now',
                  timezone,
                  'var-ds': 'cb3a3391-700f-4cc6-81be-a122488e93e6',
                  'var-filters': [],
                  refresh: '',
                },
                type: 'start',
                description: 'Test',
              },
              {
                urlValues: {
                  metric: 'access_permissions_duration_count',
                  from: 'now-1h',
                  to: 'now',
                  timezone,
                  'var-ds': 'cb3a3391-700f-4cc6-81be-a122488e93e6',
                  'var-filters': [],
                  refresh: '',
                },
                type: 'time',
                description: 'Test',
              },
            ],
          },
        ])
      );
      getTrailStore().load();
    });

    const store = getTrailStore();

    it('should have no recent trails', () => {
      expect(store.recent.length).toBe(0);
    });

    it('should accurately load legacy bookmark', () => {
      expect(store.bookmarks.length).toBe(1);
      const trail = store.getTrailForBookmarkIndex(0);
      expect(trail.state.metric).toBe('access_permissions_duration_count');
    });
  });

  describe('Initialize store with one legacy bookmark trail not bookmarked on final step', () => {
    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem(
        TRAIL_BOOKMARKS_KEY,
        JSON.stringify([
          {
            history: [
              {
                urlValues: {
                  from: 'now-1h',
                  to: 'now',
                  'var-ds': 'prom-mock',
                  'var-filters': [],
                  refresh: '',
                },
                type: 'start',
              },
              {
                urlValues: {
                  metric: 'bookmarked_metric',
                  from: 'now-1h',
                  to: 'now',
                  'var-ds': 'prom-mock',
                  'var-filters': [],
                  refresh: '',
                },
                type: 'time',
              },
              {
                urlValues: {
                  metric: 'some_other_metric',
                  from: 'now-1h',
                  to: 'now',
                  'var-ds': 'prom-mock',
                  'var-filters': [],
                  refresh: '',
                },
                type: 'metric',
              },
            ],
            currentStep: 1,
          },
        ])
      );
      getTrailStore().load();
    });

    const store = getTrailStore();

    it('should have no recent trails', () => {
      expect(store.recent.length).toBe(0);
    });

    it('should accurately load legacy bookmark', () => {
      expect(store.bookmarks.length).toBe(1);
      const trail = store.getTrailForBookmarkIndex(0);
      expect(trail.state.metric).toBe('bookmarked_metric');
    });
  });

  describe('Initialize store with one bookmark matching recent trail not on final step', () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    beforeEach(() => {
      localStorage.clear();
      localStorage.setItem(
        RECENT_TRAILS_KEY,
        JSON.stringify([
          {
            history: [
              {
                urlValues: {
                  from: 'now-1h',
                  to: 'now',
                  timezone,
                  'var-ds': 'prom-mock',
                  'var-deployment_environment': ['undefined'],
                  'var-otel_resources': [''],
                  'var-filters': [],
                  refresh: '',
                },
                type: 'start',
              },
              {
                urlValues: {
                  metric: 'bookmarked_metric',
                  from: 'now-1h',
                  to: 'now',
                  timezone,
                  'var-ds': 'prom-mock',
                  'var-deployment_environment': ['undefined'],
                  'var-otel_resources': [''],
                  'var-filters': [],
                  refresh: '',
                },
                type: 'time',
              },
              {
                urlValues: {
                  metric: 'some_other_metric',
                  from: 'now-1h',
                  to: 'now',
                  timezone,
                  'var-ds': 'prom-mock',
                  'var-deployment_environment': ['undefined'],
                  'var-otel_resources': [''],
                  'var-filters': [],
                  refresh: '',
                },
                type: 'metric',
              },
            ],
            currentStep: 1,
          },
        ])
      );
      localStorage.setItem(
        TRAIL_BOOKMARKS_KEY,
        JSON.stringify([
          {
            urlValues: {
              metric: 'bookmarked_metric',
              from: 'now-1h',
              to: 'now',
              timezone,
              'var-ds': 'prom-mock',
              'var-deployment_environment': ['undefined'],
              'var-otel_resources': [''],
              'var-filters': [],
              refresh: '',
            },
            type: 'time',
          },
        ])
      );
      getTrailStore().load();
    });

    const store = getTrailStore();

    it('should have 1 recent trail', () => {
      expect(store.recent.length).toBe(1);
    });

    it('should accurately load bookmarked trail from matching recent', () => {
      expect(store.bookmarks.length).toBe(1);
      expect(store.recent.length).toBe(1);
      const trail = store.getTrailForBookmarkIndex(0);
      expect(trail.state.history.state.steps.length).toBe(3);
      expect(trail.state.history.state.steps[0].type).toBe('start');
      expect(trail.state.history.state.steps[1].type).toBe('time');
      expect(trail.state.history.state.steps[2].type).toBe('metric');
    });

    it('should save a new recent trail based on the bookmark', () => {
      expect(store.recent.length).toBe(1);
      const trail = store.getTrailForBookmarkIndex(0);
      store.setRecentTrail(trail);
      expect(store.recent.length).toBe(1);
    });

    it('should be able to obtain index of bookmark', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(0);
    });

    it('index should be undefined for removed bookmarks', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      store.removeBookmark(0);
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(undefined);
    });

    it('index should be undefined for a trail that has changed since it was bookmarked', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      trail.setState({ metric: 'something_completely_different' });
      const index = store.getBookmarkIndex(trail);
      expect(index).toBe(undefined);
    });

    it('should be able to obtain index of a bookmark for a trail that changed back to bookmarked state', () => {
      const trail = store.getTrailForBookmarkIndex(0);
      trail.setState({ metric: 'something_completely_different' });
      expect(store.getBookmarkIndex(trail)).toBe(undefined);
      trail.setState({ metric: 'bookmarked_metric' });
      expect(store.getBookmarkIndex(trail)).toBe(0);
    });

    it('should remove a bookmark', () => {
      expect(store.bookmarks.length).toBe(1);
      store.removeBookmark(0);
      expect(store.bookmarks.length).toBe(0);
      jest.advanceTimersByTime(2000);
      expect(localStorage.getItem(TRAIL_BOOKMARKS_KEY)).toBe('[]');
    });
  });
});
