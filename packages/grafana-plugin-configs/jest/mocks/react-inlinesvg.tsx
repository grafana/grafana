// Stands in for both `react-inlinesvg` and `react-inlinesvg/provider` (the moduleNameMapper entry
// matches both), so that grafana/ui's Icon and any SVG a plugin renders directly never make fetch
// requests for `/public/img/icons/<icon_name>.svg` in tests.

import { type Ref } from 'react';

export interface StorageItem {
  content: string;
  error?: Error;
  status: 'idle' | 'loading' | 'loaded' | 'failed' | 'ready' | 'unsupported';
}

const contents = new Map<string, StorageItem>();

// Unlike the real cache store, a url nobody has registered still counts as cached, so icons render
// synchronously in tests that don't care about their markup. Tests that do care can seed content
// through the regular `cacheStore.set` API, and use a `loading` or `failed` status to exercise the
// asynchronous paths.
function defaultContent() {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>';
}

export const cacheStore = {
  isCached: (url: string) => (contents.get(url)?.status ?? 'loaded') === 'loaded',
  getContent: (url: string) => contents.get(url)?.content || defaultContent(),
  get: async (url: string) => {
    const item = contents.get(url);

    if (item?.status === 'failed') {
      throw item.error ?? new Error(`Failed to fetch ${url}`);
    }

    const content = item?.content || defaultContent();
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

const SVG_FILE_NAME_REGEX = /(.+)\/(.+)\.svg$/;

const InlineSVG = ({ src, innerRef, ...rest }: { src: string; innerRef: Ref<SVGSVGElement> }) => {
  // testId will be the file name without extension (e.g. `public/img/icons/angle-double-down.svg` -> `angle-double-down`)
  const testId = src.replace(SVG_FILE_NAME_REGEX, '$2');
  return <svg xmlns="http://www.w3.org/2000/svg" data-testid={testId} viewBox="0 0 24 24" ref={innerRef} {...rest} />;
};

export default InlineSVG;
