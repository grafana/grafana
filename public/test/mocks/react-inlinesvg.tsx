import { type Ref, useEffect } from 'react';

interface StorageItem {
  content: string;
  error?: Error;
  status: 'idle' | 'loading' | 'loaded' | 'failed' | 'ready' | 'unsupported';
}

/**
 * Stands in for both `react-inlinesvg` and `react-inlinesvg/provider` (the moduleNameMapper entry
 * matches both), so tests never hit the network for an SVG.
 *
 * Unlike the real cache store, a url nobody has registered still counts as cached and resolves to
 * `<svg id="{url}" />`, so icons render synchronously in tests that don't care about their markup.
 * Tests that do care can seed content through the regular `cacheStore.set` API, and use a
 * `loading` or `failed` status to exercise the asynchronous paths.
 */
const contents = new Map<string, StorageItem>();

function defaultContent(url: string) {
  return `<svg id="${url}"></svg>`;
}

export const cacheStore = {
  isCached: (url: string) => (contents.get(url)?.status ?? 'loaded') === 'loaded',
  getContent: (url: string) => contents.get(url)?.content || defaultContent(url),
  get: async (url: string) => {
    const item = contents.get(url);

    if (item?.status === 'failed') {
      throw item.error ?? new Error(`Failed to fetch ${url}`);
    }

    const content = item?.content || defaultContent(url);
    contents.set(url, { content, status: 'loaded' });

    return content;
  },
  set: (url: string, data: StorageItem) => contents.set(url, data),
  delete: async (url: string) => contents.delete(url),
  clear: async () => contents.clear(),
  keys: () => [...contents.keys()],
};

export function useCacheStore() {
  return null;
}

export default function ReactInlineSVG({
  src,
  innerRef,
  cacheRequests,
  preProcessor,
  onLoad,
  ...rest
}: {
  src: string;
  innerRef: Ref<SVGSVGElement>;
  cacheRequests: boolean;
  preProcessor: () => string;
  onLoad?: () => void;
}) {
  // Simulate async loading behavior
  useEffect(() => {
    if (onLoad) {
      // Call onLoad synchronously in tests to avoid timing issues
      onLoad();
    }
  }, [src, onLoad]);

  return <svg id={src} ref={innerRef} {...rest} />;
}
