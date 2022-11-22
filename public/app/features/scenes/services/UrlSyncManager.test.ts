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
  protected _urlSync = new SceneObjectUrlSyncConfig({
    keys: ['name'],
    getUrlState: () => new Map([['name', this.state.name]]),
    updateFromUrl: (values) => {
      this.setState({ name: values.get('name') ?? 'NA' });
    },
  });
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
      const location = locationService.getSearchObject();
      expect(location.name).toBe('test2');

      // When making unrelated state change
      obj.setState({ other: 'not synced' });

      // Should not update url
      expect(locationUpdates.length).toBe(1);
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
});
