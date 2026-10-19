import { type JsonValue } from '@openfeature/react-sdk';
import { act, renderHook } from '@testing-library/react';
import { type Location } from 'history';
import { getWrapper } from 'test/test-utils';

import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { useIsUrlAllowed } from './mtFallback';

function locationFor(pathname: string): Location {
  return { pathname, search: '', hash: '', state: undefined };
}

function renderUseIsUrlAllowed(pathname: string) {
  return renderHook(() => useIsUrlAllowed(locationFor(pathname)), { wrapper: getWrapper({}) });
}

// setTestFlags fires OpenFeature events that update React state; wrap in act() so those
// updates are flushed before the hook under test is rendered.
async function setMTFallbackFlag(value: JsonValue) {
  await act(async () => {
    setTestFlags({ [FlagKeys.GrafanaMtFallback]: value });
  });
}

describe('useIsUrlAllowed', () => {
  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it('allows every path when the flag has no allow list', async () => {
    await setMTFallbackFlag({});

    const { result } = renderUseIsUrlAllowed('/some/random/path');

    expect(result.current).toBe(true);
  });

  describe('with an allow list of exact and wildcard patterns', () => {
    beforeEach(async () => {
      await setMTFallbackFlag({ allowList: ['/', '/dashboards/*', '/a/grafana-metricsdrilldown-app/*'] });
    });

    it.each([
      ['/', 'the exact root entry'],
      ['/dashboards', 'an exact allow-listed entry'],
      ['/dashboards/foo', 'a path nested under a wildcard entry'],
      ['/a/grafana-metricsdrilldown-app/foo', 'another path nested under a wildcard entry'],
      ['/a/grafana-metricsdrilldown-app/foo/bar', 'a deeply nested path under a wildcard entry'],
    ])('allows %s (%s)', (pathname) => {
      const { result } = renderUseIsUrlAllowed(pathname);

      expect(result.current).toBe(true);
    });

    it('does not allow a path that is not in the allow list', () => {
      const { result } = renderUseIsUrlAllowed('/explore');

      expect(result.current).toBe(false);
    });
  });
});
