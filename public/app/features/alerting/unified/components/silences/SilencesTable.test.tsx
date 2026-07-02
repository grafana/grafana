import { renderHook } from '@testing-library/react';

import { SilenceState } from 'app/plugins/datasource/alertmanager/types';

import { mockSilence } from '../../mocks';

import { useFilteredSilences } from './SilencesTable';

const mockUseQueryParams = jest.fn();
jest.mock('app/core/hooks/useQueryParams', () => ({
  useQueryParams: () => mockUseQueryParams(),
}));

function setQueryString(queryString: string | null) {
  const params = queryString ? { queryString } : {};
  mockUseQueryParams.mockReturnValue([params, jest.fn()]);
}

describe('useFilteredSilences', () => {
  beforeEach(() => {
    setQueryString(null);
  });

  describe('no query string', () => {
    it('returns active silences when no filter is set', () => {
      const silences = [
        mockSilence({ id: '1', status: { state: SilenceState.Active } }),
        mockSilence({ id: '2', status: { state: SilenceState.Expired } }),
      ];
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current.map((s) => s.id)).toEqual(['1']);
    });

    it('returns expired silences when expired=true', () => {
      const silences = [
        mockSilence({ id: '1', status: { state: SilenceState.Active } }),
        mockSilence({ id: '2', status: { state: SilenceState.Expired } }),
      ];
      const { result } = renderHook(() => useFilteredSilences(silences, true));
      expect(result.current.map((s) => s.id)).toEqual(['2']);
    });
  });

  describe('label matcher search (existing behaviour)', () => {
    it('matches a silence whose label matchers satisfy the query exactly', () => {
      const silences = [
        mockSilence({ id: '1', matchers: [{ name: 'env', value: 'prod', isEqual: true, isRegex: false }] }),
        mockSilence({ id: '2', matchers: [{ name: 'env', value: 'staging', isEqual: true, isRegex: false }] }),
      ];
      setQueryString('env="prod"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current.map((s) => s.id)).toEqual(['1']);
    });

    it('does not match when operator differs', () => {
      const silences = [
        // Silence has env!=prod (negated), query searches for env=prod (equals)
        mockSilence({ id: '1', matchers: [{ name: 'env', value: 'prod', isEqual: false, isRegex: false }] }),
      ];
      setQueryString('env="prod"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current).toHaveLength(0);
    });

    it('does not match when value differs', () => {
      const silences = [
        mockSilence({ id: '1', matchers: [{ name: 'env', value: 'staging', isEqual: true, isRegex: false }] }),
      ];
      setQueryString('env="prod"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current).toHaveLength(0);
    });
  });

  describe('alertname search — label matcher path', () => {
    it('matches a silence with an alertname label matcher equal to the query value', () => {
      const silences = [
        mockSilence({ id: '1', matchers: [{ name: 'alertname', value: 'HighCPU', isEqual: true, isRegex: false }] }),
        mockSilence({ id: '2', matchers: [{ name: 'alertname', value: 'LowDisk', isEqual: true, isRegex: false }] }),
      ];
      setQueryString('alertname="HighCPU"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current.map((s) => s.id)).toEqual(['1']);
    });
  });

  describe('alertname search — rule_title fallback (exception)', () => {
    it('matches a silence whose metadata.rule_title equals the query value', () => {
      const silences = [
        mockSilence({ id: '1', matchers: [{ name: 'env', value: 'prod', isEqual: true, isRegex: false }], metadata: { rule_title: 'HighCPU' } }),
        mockSilence({ id: '2', matchers: [{ name: 'env', value: 'prod', isEqual: true, isRegex: false }], metadata: { rule_title: 'LowDisk' } }),
      ];
      setQueryString('alertname="HighCPU"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current.map((s) => s.id)).toEqual(['1']);
    });

    it('does not match when rule_title differs from query value', () => {
      const silences = [
        mockSilence({ id: '1', matchers: [], metadata: { rule_title: 'LowDisk' } }),
      ];
      setQueryString('alertname="HighCPU"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current).toHaveLength(0);
    });

    it('matches via rule_title when the silence has no alertname label matcher at all', () => {
      const silences = [
        mockSilence({ id: '1', matchers: [{ name: 'env', value: 'prod', isEqual: true, isRegex: false }], metadata: { rule_title: 'HighCPU' } }),
      ];
      setQueryString('alertname="HighCPU"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current.map((s) => s.id)).toEqual(['1']);
    });

    it('matches via alertname label matcher even when rule_title does not match', () => {
      const silences = [
        mockSilence({
          id: '1',
          matchers: [{ name: 'alertname', value: 'HighCPU', isEqual: true, isRegex: false }],
          metadata: { rule_title: 'SomethingElse' },
        }),
      ];
      setQueryString('alertname="HighCPU"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current.map((s) => s.id)).toEqual(['1']);
    });

    it('matches via rule_title with a regex operator (anchored, so partial patterns do not match)', () => {
      const silences = [
        mockSilence({ id: '1', matchers: [], metadata: { rule_title: 'HighCPU Usage' } }),
        mockSilence({ id: '2', matchers: [], metadata: { rule_title: 'LowDisk' } }),
      ];
      setQueryString('alertname=~"High.*"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current.map((s) => s.id)).toEqual(['1']);
    });

    it('does not match rule_title when the regex only matches a substring (anchored)', () => {
      const silences = [
        mockSilence({ id: '1', matchers: [], metadata: { rule_title: 'HighCPU Usage' } }),
      ];
      // "CPU" without anchors would match as a substring, but anchoring ^(?:CPU)$ requires full-string match
      setQueryString('alertname=~"CPU"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current).toHaveLength(0);
    });

    it('is case-sensitive when matching rule_title', () => {
      const silences = [
        mockSilence({ id: '1', matchers: [], metadata: { rule_title: 'HighCPU' } }),
      ];
      setQueryString('alertname="highcpu"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current).toHaveLength(0);
    });

    it('does not apply the rule_title fallback to non-alertname keys', () => {
      const silences = [
        // rule_title happens to equal the searched value, but the key is "env", not "alertname"
        mockSilence({ id: '1', matchers: [], metadata: { rule_title: 'prod' } }),
      ];
      setQueryString('env="prod"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current).toHaveLength(0);
    });

    it('skips the rule_title check when metadata is absent', () => {
      const silences = [
        mockSilence({ id: '1', matchers: [] }), // no metadata
      ];
      setQueryString('alertname="HighCPU"');
      const { result } = renderHook(() => useFilteredSilences(silences, false));
      expect(result.current).toHaveLength(0);
    });
  });
});
