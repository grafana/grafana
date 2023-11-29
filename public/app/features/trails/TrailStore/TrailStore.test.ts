import { BOOKMARKED_TRAILS_KEY, RECENT_TRAILS_KEY } from '../shared';

import { getTrailStore } from './TrailStore';

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
    beforeAll(() => {
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
                type: 'metric',
                description: 'Test',
              },
            ],
          },
        ])
      );
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
