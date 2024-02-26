import { renderHook } from '@testing-library/react-hooks';

import { ReactivePluginExtensionsRegistry } from './reactivePluginExtensionRegistry';
import { createPluginExtensionsHook } from './usePluginExtensions';

describe('usePluginExtensions()', () => {
  let reactiveRegistry: ReactivePluginExtensionsRegistry;

  beforeEach(() => {
    reactiveRegistry = new ReactivePluginExtensionsRegistry();
  });

  it('should return an empty array if there are no extensions registered for the extension point', () => {
    const usePluginExtensions = createPluginExtensionsHook(reactiveRegistry);
    const { result } = renderHook(() =>
      usePluginExtensions({
        extensionPointId: 'foo/bar',
      })
    );

    expect(result.current.extensions).toEqual([]);
  });
});
