import { BOOKMARKED_TRAILS_KEY, RECENT_TRAILS_KEY } from '../shared';

import { SerializedTrail, getTrailStore } from './TrailStore';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    getAdhocFilters: jest.fn().mockReturnValue([{ key: 'origKey', operator: '=', value: '' }]),
  }),
}));

describe('TrailStore', () => {
  beforeAll(() => {
    let localStore: Record<string, string> = {};

    const localStorageMock = {
      getItem: jest.fn((key) => (key in localStore ? localStore[key] : null)),
      setItem: jest.fn(jest.fn((key, value) => (localStore[key] = value + ''))),
      clear: jest.fn(() => (localStore = {})),
    };
    global.localStorage = localStorageMock as unknown as Storage;

    jest.useFakeTimers();
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

  describe('Initialize store with one recent trail', () => {
    const history: SerializedTrail['history'] = [
      {
        urlValues: {
          from: 'now-1h',
          to: 'now',
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
      ['var-ds', '1234'],
      ['var-groupby', 'job'],
      ['var-filters', 'test'],
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
  });
  describe('Initialize store with one bookmark trail', () => {
    beforeAll(() => {
      localStorage.clear();
      localStorage.setItem(
        BOOKMARKED_TRAILS_KEY,
        JSON.stringify([
          {
            history: [
              {
                urlValues: {
                  from: 'now-1h',
                  to: 'now',
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

    it('should accurately load bookmarked trails', () => {
      expect(store.bookmarks.length).toBe(1);
      const trail = store.bookmarks[0].resolve();
      expect(trail.state.history.state.steps.length).toBe(2);
      expect(trail.state.history.state.steps[0].type).toBe('start');
      expect(trail.state.history.state.steps[1].type).toBe('time');
    });

    it('should save a new recent trail based on the bookmark', () => {
      expect(store.recent.length).toBe(0);
      const trail = store.bookmarks[0].resolve();
      store.setRecentTrail(trail);
      expect(store.recent.length).toBe(1);
    });

    it('should remove a bookmark', () => {
      expect(store.bookmarks.length).toBe(1);
      store.removeBookmark(0);
      expect(store.bookmarks.length).toBe(0);

      jest.advanceTimersByTime(2000);

      expect(localStorage.getItem(BOOKMARKED_TRAILS_KEY)).toBe('[]');
    });
  });
});
