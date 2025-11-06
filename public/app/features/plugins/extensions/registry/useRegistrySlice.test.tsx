import { renderHook } from '@testing-library/react';
import React from 'react';

import { ExtensionRegistriesProvider } from '../ExtensionRegistriesContext';

import { AddedComponentsRegistry } from './AddedComponentsRegistry';
import { AddedFunctionsRegistry } from './AddedFunctionsRegistry';
import { AddedLinksRegistry } from './AddedLinksRegistry';
import { ExposedComponentsRegistry } from './ExposedComponentsRegistry';
import { PluginExtensionRegistries } from './types';
import {
  useAddedComponentsRegistrySlice,
  useAddedFunctionsRegistrySlice,
  useAddedLinksRegistrySlice,
  useExposedComponentRegistrySlice,
} from './useRegistrySlice';

describe('useRegistrySlice', () => {
  let registries: PluginExtensionRegistries;
  let wrapper: ({ children }: { children: React.ReactNode }) => JSX.Element;

  beforeEach(() => {
    registries = {
      addedComponentsRegistry: new AddedComponentsRegistry(),
      exposedComponentsRegistry: new ExposedComponentsRegistry(),
      addedLinksRegistry: new AddedLinksRegistry(),
      addedFunctionsRegistry: new AddedFunctionsRegistry(),
    };

    wrapper = ({ children }: { children: React.ReactNode }) => (
      <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
    );
  });

  describe('useAddedComponentsRegistrySlice', () => {
    it('should return undefined when no components are registered for the extension point', () => {
      const { result } = renderHook(() => useAddedComponentsRegistrySlice('test/extension-point'), { wrapper });

      expect(result.current).toBeUndefined();
    });

    it('should return an array of components when components are registered for the extension point', () => {
      const extensionPointId = 'test/extension-point';
      const TestComponent = () => <div>Test Component</div>;

      registries.addedComponentsRegistry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            title: 'Test Component',
            component: TestComponent,
            targets: extensionPointId,
            description: 'Test description',
          },
        ],
      });

      const { result } = renderHook(() => useAddedComponentsRegistrySlice(extensionPointId), { wrapper });

      expect(result.current).toBeDefined();
      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current?.length).toBe(1);
      expect(result.current?.[0].title).toBe('Test Component');
      expect(result.current?.[0].pluginId).toBe('test-plugin');
      expect(result.current?.[0].description).toBe('Test description');
    });

    it('should return multiple components when multiple components are registered for the same extension point', () => {
      const extensionPointId = 'test/extension-point';
      const TestComponent1 = () => <div>Test Component 1</div>;
      const TestComponent2 = () => <div>Test Component 2</div>;

      registries.addedComponentsRegistry.register({
        pluginId: 'test-plugin-1',
        configs: [
          {
            title: 'Test Component 1',
            component: TestComponent1,
            targets: extensionPointId,
            description: 'Test description 1',
          },
        ],
      });

      registries.addedComponentsRegistry.register({
        pluginId: 'test-plugin-2',
        configs: [
          {
            title: 'Test Component 2',
            component: TestComponent2,
            targets: extensionPointId,
            description: 'Test description 2',
          },
        ],
      });

      const { result } = renderHook(() => useAddedComponentsRegistrySlice(extensionPointId), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current?.length).toBe(2);
      expect(result.current?.[0].title).toBe('Test Component 1');
      expect(result.current?.[0].description).toBe('Test description 1');
      expect(result.current?.[1].title).toBe('Test Component 2');
      expect(result.current?.[1].description).toBe('Test description 2');
    });

    it('should only return components for the specified extension point', () => {
      const extensionPointId1 = 'test/extension-point-1';
      const extensionPointId2 = 'test/extension-point-2';
      const TestComponent1 = () => <div>Test Component 1</div>;
      const TestComponent2 = () => <div>Test Component 2</div>;

      registries.addedComponentsRegistry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            title: 'Test Component 1',
            component: TestComponent1,
            targets: extensionPointId1,
            description: 'Test description 1',
          },
          {
            title: 'Test Component 2',
            component: TestComponent2,
            targets: extensionPointId2,
            description: 'Test description 2',
          },
        ],
      });

      const { result } = renderHook(() => useAddedComponentsRegistrySlice(extensionPointId1), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current?.length).toBe(1);
      expect(result.current?.[0].title).toBe('Test Component 1');
      expect(result.current?.[0].description).toBe('Test description 1');
    });
  });

  describe('useExposedComponentsRegistrySlice', () => {
    it('should return undefined when no component is exposed for the extension point', () => {
      const { result } = renderHook(() => useExposedComponentRegistrySlice('test/exposed-component'), { wrapper });

      expect(result.current).toBeUndefined();
    });

    it('should return a single exposed component when registered', () => {
      const exposedComponentId = 'test-plugin/exposed-component';
      const TestComponent = () => <div>Exposed Component</div>;

      registries.exposedComponentsRegistry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            id: exposedComponentId,
            title: 'Exposed Component',
            component: TestComponent,
          },
        ],
      });

      const { result } = renderHook(() => useExposedComponentRegistrySlice(exposedComponentId), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current?.title).toBe('Exposed Component');
      expect(result.current?.pluginId).toBe('test-plugin');
      expect(Array.isArray(result.current)).toBe(false);
    });

    it('should return undefined for a different extension point id', () => {
      const exposedComponentId = 'test-plugin/exposed-component';
      const otherId = 'test-plugin/other-component';
      const TestComponent = () => <div>Exposed Component</div>;

      registries.exposedComponentsRegistry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            id: exposedComponentId,
            title: 'Exposed Component',
            component: TestComponent,
          },
        ],
      });

      const { result } = renderHook(() => useExposedComponentRegistrySlice(otherId), { wrapper });

      expect(result.current).toBeUndefined();
    });
  });

  describe('useAddedLinksRegistrySlice', () => {
    it('should return undefined when no links are registered for the extension point', () => {
      const { result } = renderHook(() => useAddedLinksRegistrySlice('test/extension-point'), { wrapper });

      expect(result.current).toBeUndefined();
    });

    it('should return an array of links when links are registered for the extension point', () => {
      const extensionPointId = 'test/extension-point';

      registries.addedLinksRegistry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            title: 'Test Link',
            path: '/test-path',
            targets: extensionPointId,
          },
        ],
      });

      const { result } = renderHook(() => useAddedLinksRegistrySlice(extensionPointId), { wrapper });

      expect(result.current).toBeDefined();
      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current?.length).toBe(1);
      expect(result.current?.[0].title).toBe('Test Link');
      expect(result.current?.[0].path).toBe('/test-path');
      expect(result.current?.[0].pluginId).toBe('test-plugin');
    });

    it('should return multiple links when multiple links are registered for the same extension point', () => {
      const extensionPointId = 'test/extension-point';

      registries.addedLinksRegistry.register({
        pluginId: 'test-plugin-1',
        configs: [
          {
            title: 'Test Link 1',
            path: '/test-path-1',
            targets: extensionPointId,
          },
        ],
      });

      registries.addedLinksRegistry.register({
        pluginId: 'test-plugin-2',
        configs: [
          {
            title: 'Test Link 2',
            path: '/test-path-2',
            targets: extensionPointId,
          },
        ],
      });

      const { result } = renderHook(() => useAddedLinksRegistrySlice(extensionPointId), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current?.length).toBe(2);
      expect(result.current?.[0].title).toBe('Test Link 1');
      expect(result.current?.[1].title).toBe('Test Link 2');
    });

    it('should only return links for the specified extension point', () => {
      const extensionPointId1 = 'test/extension-point-1';
      const extensionPointId2 = 'test/extension-point-2';

      registries.addedLinksRegistry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            title: 'Test Link 1',
            path: '/test-path-1',
            targets: extensionPointId1,
          },
          {
            title: 'Test Link 2',
            path: '/test-path-2',
            targets: extensionPointId2,
          },
        ],
      });

      const { result } = renderHook(() => useAddedLinksRegistrySlice(extensionPointId1), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current?.length).toBe(1);
      expect(result.current?.[0].title).toBe('Test Link 1');
    });
  });

  describe('useAddedFunctionsRegistrySlice', () => {
    it('should return undefined when no functions are registered for the extension point', () => {
      const { result } = renderHook(() => useAddedFunctionsRegistrySlice('test/extension-point'), { wrapper });

      expect(result.current).toBeUndefined();
    });

    it('should return an array of functions when functions are registered for the extension point', () => {
      const extensionPointId = 'test/extension-point';
      const testFunction = jest.fn();

      registries.addedFunctionsRegistry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            title: 'Test Function',
            fn: testFunction,
            targets: extensionPointId,
          },
        ],
      });

      const { result } = renderHook(() => useAddedFunctionsRegistrySlice(extensionPointId), { wrapper });

      expect(result.current).toBeDefined();
      expect(Array.isArray(result.current)).toBe(true);
      expect(result.current?.length).toBe(1);
      expect(result.current?.[0].title).toBe('Test Function');
      expect(result.current?.[0].fn).toBe(testFunction);
      expect(result.current?.[0].pluginId).toBe('test-plugin');
    });

    it('should return multiple functions when multiple functions are registered for the same extension point', () => {
      const extensionPointId = 'test/extension-point';
      const testFunction1 = jest.fn();
      const testFunction2 = jest.fn();

      registries.addedFunctionsRegistry.register({
        pluginId: 'test-plugin-1',
        configs: [
          {
            title: 'Test Function 1',
            fn: testFunction1,
            targets: extensionPointId,
          },
        ],
      });

      registries.addedFunctionsRegistry.register({
        pluginId: 'test-plugin-2',
        configs: [
          {
            title: 'Test Function 2',
            fn: testFunction2,
            targets: extensionPointId,
          },
        ],
      });

      const { result } = renderHook(() => useAddedFunctionsRegistrySlice(extensionPointId), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current?.length).toBe(2);
      expect(result.current?.[0].title).toBe('Test Function 1');
      expect(result.current?.[0].fn).toBe(testFunction1);
      expect(result.current?.[1].title).toBe('Test Function 2');
      expect(result.current?.[1].fn).toBe(testFunction2);
    });

    it('should only return functions for the specified extension point', () => {
      const extensionPointId1 = 'test/extension-point-1';
      const extensionPointId2 = 'test/extension-point-2';
      const testFunction1 = jest.fn();
      const testFunction2 = jest.fn();

      registries.addedFunctionsRegistry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            title: 'Test Function 1',
            fn: testFunction1,
            targets: extensionPointId1,
          },
          {
            title: 'Test Function 2',
            fn: testFunction2,
            targets: extensionPointId2,
          },
        ],
      });

      const { result } = renderHook(() => useAddedFunctionsRegistrySlice(extensionPointId1), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current?.length).toBe(1);
      expect(result.current?.[0].title).toBe('Test Function 1');
      expect(result.current?.[0].fn).toBe(testFunction1);
    });
  });

  describe('observable memoization', () => {
    it('should memoize the observable when extensionPointId and registry do not change', () => {
      const extensionPointId = 'test/extension-point';
      const TestComponent = () => <div>Test Component</div>;

      registries.addedComponentsRegistry.register({
        pluginId: 'test-plugin',
        configs: [
          {
            title: 'Test Component',
            component: TestComponent,
            targets: extensionPointId,
            description: 'Test description',
          },
        ],
      });

      const { result, rerender } = renderHook(() => useAddedComponentsRegistrySlice(extensionPointId), { wrapper });

      const firstResult = result.current;

      rerender();

      expect(result.current).toBe(firstResult);
    });
  });
});
