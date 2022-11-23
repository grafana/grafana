import { Location } from 'history';

import { locationService } from '@grafana/runtime';

import { SceneFlexLayout } from '../components';
import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneLayoutChildState } from '../core/types';

import { SceneObjectUrlSyncConfig } from './SceneObjectUrlSyncConfig';
import { UrlSyncManager } from './UrlSyncManager';

interface TestObjectState extends SceneLayoutChildState {
  name: string;
  other?: string;
}

class TestObj extends SceneObjectBase<TestObjectState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['name'],
  });

  public getUrlState(state: TestObjectState) {
    return new Map([['name', state.name]]);
  }

  public updateFromUrl(values: Map<string, string>) {
    this.setState({ name: values.get('name') ?? 'NA' });
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
      const obj1 = new TestObj({ name: 'obj1' });
      const obj2 = new TestObj({ name: 'obj2' });

      const scene = new SceneFlexLayout({
        children: [
          obj1,
          new SceneFlexLayout({
            children: [obj2],
          }),
        ],
      });

      urlManager = new UrlSyncManager(scene);

      // When making state changes for second object with same key
      obj2.setState({ name: 'test2' });

      // Should use unique key based where it is in the scene
      expect(locationService.getSearchObject()).toEqual({ ['name-2']: 'test2' });

      obj1.setState({ name: 'test1' });

      // Should not suffix key for first object
      expect(locationService.getSearchObject()).toEqual({
        name: 'test1',
        ['name-2']: 'test2',
      });

      // When updating via url
      locationService.partial({ ['name-2']: 'updated-from-url' });
      // should find the correct object
      expect(obj2.state.name).toBe('updated-from-url');
      // should not update the first object
      expect(obj1.state.name).toBe('test1');
    });
  });
});
