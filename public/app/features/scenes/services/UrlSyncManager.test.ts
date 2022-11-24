import { Location } from 'history';

import { locationService } from '@grafana/runtime';

import { SceneFlexLayout } from '../components';
import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneLayoutChildState, SceneObjectUrlValues } from '../core/types';

import { SceneObjectUrlSyncConfig } from './SceneObjectUrlSyncConfig';
import { isUrlValueEqual, UrlSyncManager } from './UrlSyncManager';

interface TestObjectState extends SceneLayoutChildState {
  name: string;
  array?: string[];
  other?: string;
}

class TestObj extends SceneObjectBase<TestObjectState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['name', 'array'] });

  public getUrlState(state: TestObjectState) {
    return { name: state.name, array: state.array };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.name === 'string') {
      this.setState({ name: values.name ?? 'NA' });
    }
    if (Array.isArray(values.array)) {
      this.setState({ array: values.array });
    }
  }
}

describe('UrlSyncManager', () => {
  let urlManager: UrlSyncManager;
  let locationUpdates: Location[] = [];
  let listenUnregister: () => void;

  beforeEach(() => {
    locationUpdates = [];
    listenUnregister = locationService.getHistory().listen((location) => {
      locationUpdates.push(location);
    });
  });

  afterEach(() => {
    urlManager.cleanUp();
    locationService.push('/');
    listenUnregister();
  });

  describe('When state changes', () => {
    it('should update url', () => {
      const obj = new TestObj({ name: 'test' });
      const scene = new SceneFlexLayout({
        children: [obj],
      });

      urlManager = new UrlSyncManager(scene);

      // When making state change
      obj.setState({ name: 'test2' });

      // Should update url
      const searchObj = locationService.getSearchObject();
      expect(searchObj.name).toBe('test2');

      // When making unrelated state change
      obj.setState({ other: 'not synced' });

      // Should not update url
      expect(locationUpdates.length).toBe(1);

      // When clearing url (via go back)
      locationService.getHistory().goBack();

      // Should restore to initial state
      expect(obj.state.name).toBe('test');
    });
  });

  describe('When url changes', () => {
    it('should update state', () => {
      const obj = new TestObj({ name: 'test' });
      const initialObjState = obj.state;
      const scene = new SceneFlexLayout({
        children: [obj],
      });

      urlManager = new UrlSyncManager(scene);

      // When non relevant key changes in url
      locationService.partial({ someOtherProp: 'test2' });
      // Should not affect state
      expect(obj.state).toBe(initialObjState);

      // When relevant key changes in url
      locationService.partial({ name: 'test2' });
      // Should update state
      expect(obj.state.name).toBe('test2');

      // When relevant key is cleared (say go back)
      locationService.partial({ name: null });
      // Should revert to initial state
      expect(obj.state.name).toBe('test');

      // When relevant key is set to current state
      const currentState = obj.state;
      locationService.partial({ name: currentState.name });
      // Should not affect state (same instance)
      expect(obj.state).toBe(currentState);
    });
  });

  describe('When multiple scene objects wants to set same url keys', () => {
    it('should give each object a unique key', () => {
      const outerTimeRange = new SceneTimeRange();
      const innerTimeRange = new SceneTimeRange();

      const scene = new SceneFlexLayout({
        children: [
          new SceneFlexLayout({
            $timeRange: innerTimeRange,
            children: [],
          }),
        ],
        $timeRange: outerTimeRange,
      });

      urlManager = new UrlSyncManager(scene);

      // When making state changes for second object with same key
      innerTimeRange.setState({ from: 'now-10m' });

      // Should use unique key based where it is in the scene
      expect(locationService.getSearchObject()).toEqual({
        ['from-2']: 'now-10m',
        ['to-2']: 'now',
      });

      outerTimeRange.setState({ from: 'now-20m' });

      // Should not suffix key for first object
      expect(locationService.getSearchObject()).toEqual({
        from: 'now-20m',
        to: 'now',
        ['from-2']: 'now-10m',
        ['to-2']: 'now',
      });

      // When updating via url
      locationService.partial({ ['from-2']: 'now-10s' });
      // should find the correct object
      expect(innerTimeRange.state.from).toBe('now-10s');
      // should not update the first object
      expect(outerTimeRange.state.from).toBe('now-20m');
      // Should not cause another url update
      expect(locationUpdates.length).toBe(3);
    });
  });

  describe('When updating array value', () => {
    it('Should update url correctly', () => {
      const obj = new TestObj({ name: 'test' });
      const scene = new SceneFlexLayout({
        children: [obj],
      });

      urlManager = new UrlSyncManager(scene);

      // When making state change
      obj.setState({ array: ['A', 'B'] });

      // Should update url
      const searchObj = locationService.getSearchObject();
      expect(searchObj.array).toEqual(['A', 'B']);

      // When making unrelated state change
      obj.setState({ other: 'not synced' });

      // Should not update url
      expect(locationUpdates.length).toBe(1);

      // When updating via url
      locationService.partial({ array: ['A', 'B', 'C'] });
      // Should update state
      expect(obj.state.array).toEqual(['A', 'B', 'C']);
    });
  });
});

describe('isUrlValueEqual', () => {
  it('should handle all cases', () => {
    expect(isUrlValueEqual([], [])).toBe(true);
    expect(isUrlValueEqual([], undefined)).toBe(true);
    expect(isUrlValueEqual([], null)).toBe(true);

    expect(isUrlValueEqual(['asd'], 'asd')).toBe(true);
    expect(isUrlValueEqual(['asd'], ['asd'])).toBe(true);
    expect(isUrlValueEqual(['asd', '2'], ['asd', '2'])).toBe(true);

    expect(isUrlValueEqual(['asd', '2'], 'asd')).toBe(false);
    expect(isUrlValueEqual(['asd2'], 'asd')).toBe(false);
  });
});
