import React from 'react';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';

describe('Registry.asObservableSlice ', () => {
  describe('Shared behaviour', () => {
    it('should handle selecting a non-existent key that later gets added', async () => {
      const registry = new AddedComponentsRegistry();
      const extensionPointId = 'grafana/alerting/home';
      const subscribeCallback = jest.fn();

      const observable = registry.asObservableSlice((state) => state[extensionPointId]);
      observable.subscribe(subscribeCallback);

      // Initially undefined
      expect(subscribeCallback).toHaveBeenCalledTimes(1);
      expect(subscribeCallback.mock.calls[0][0]).toBeUndefined();

      // Register component
      registry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            title: 'Test Component',
            description: 'Test description',
            targets: [extensionPointId],
            component: () => React.createElement('div', null, 'Test'),
          },
        ],
      });

      // Should emit the new value
      expect(subscribeCallback).toHaveBeenCalledTimes(2);
      expect(subscribeCallback.mock.calls[1][0]?.length).toBe(1);
    });

    it('should handle multiple subscribers independently', async () => {
      const registry = new AddedComponentsRegistry();
      const extensionPointId1 = 'grafana/alerting/home';
      const extensionPointId2 = 'grafana/other/point';
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const observable1 = registry.asObservableSlice((state) => state[extensionPointId1]);
      const observable2 = registry.asObservableSlice((state) => state[extensionPointId2]);

      observable1.subscribe(callback1);
      observable2.subscribe(callback2);

      // Both should receive initial undefined
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);

      // Register component for extensionPointId1
      registry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            title: 'Component 1',
            description: 'Description 1',
            targets: [extensionPointId1],
            component: () => React.createElement('div', null, 'Component 1'),
          },
        ],
      });

      // Only callback1 should be called
      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(1);

      // Register component for extensionPointId2
      registry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            title: 'Component 2',
            description: 'Description 2',
            targets: [extensionPointId2],
            component: () => React.createElement('div', null, 'Component 2'),
          },
        ],
      });

      // Only callback2 should be called
      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(2);
    });
  });
});
