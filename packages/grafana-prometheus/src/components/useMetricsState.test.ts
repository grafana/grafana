import { renderHook } from '@testing-library/react';

import { PrometheusDatasource } from '../datasource';
import PromQlLanguageProvider from '../language_provider';

import { useMetricsState } from './useMetricsState';

// Mock implementations
const createMockLanguageProvider = (metrics: string[] = []): PromQlLanguageProvider =>
  ({
    metrics,
  }) as unknown as PromQlLanguageProvider;

const createMockDatasource = (lookupsDisabled = false): PrometheusDatasource =>
  ({
    lookupsDisabled,
  }) as unknown as PrometheusDatasource;

describe('useMetricsState', () => {
  describe('chooserText', () => {
    it('should return disabled message when lookups are disabled', () => {
      const datasource = createMockDatasource(true);
      const languageProvider = createMockLanguageProvider([]);
      const { result } = renderHook(() => useMetricsState(datasource, languageProvider, true));
      expect(result.current.chooserText).toBe('(Disabled)');
    });

    it('should return loading message when syntax is not loaded', () => {
      const datasource = createMockDatasource();
      const languageProvider = createMockLanguageProvider(['metric1']);
      const { result } = renderHook(() => useMetricsState(datasource, languageProvider, false));
      expect(result.current.chooserText).toBe('Loading metrics...');
    });

    it('should return no metrics message when no metrics are found', () => {
      const datasource = createMockDatasource();
      const languageProvider = createMockLanguageProvider([]);
      const { result } = renderHook(() => useMetricsState(datasource, languageProvider, true));
      expect(result.current.chooserText).toBe('(No metrics found)');
    });

    it('should return metrics browser text when metrics are available', () => {
      const datasource = createMockDatasource();
      const languageProvider = createMockLanguageProvider(['metric1']);
      const { result } = renderHook(() => useMetricsState(datasource, languageProvider, true));
      expect(result.current.chooserText).toBe('Metrics browser');
    });
  });

  describe('buttonDisabled', () => {
    it('should be disabled when syntax is not loaded', () => {
      const datasource = createMockDatasource();
      const languageProvider = createMockLanguageProvider(['metric1']);
      const { result } = renderHook(() => useMetricsState(datasource, languageProvider, false));
      expect(result.current.buttonDisabled).toBe(true);
    });

    it('should be disabled when no metrics are available', () => {
      const datasource = createMockDatasource();
      const languageProvider = createMockLanguageProvider([]);
      const { result } = renderHook(() => useMetricsState(datasource, languageProvider, true));
      expect(result.current.buttonDisabled).toBe(true);
    });

    it('should be enabled when syntax is loaded and metrics are available', () => {
      const datasource = createMockDatasource();
      const languageProvider = createMockLanguageProvider(['metric1']);
      const { result } = renderHook(() => useMetricsState(datasource, languageProvider, true));
      expect(result.current.buttonDisabled).toBe(false);
    });
  });

  describe('hasMetrics', () => {
    it('should be false when no metrics are available', () => {
      const datasource = createMockDatasource();
      const languageProvider = createMockLanguageProvider([]);
      const { result } = renderHook(() => useMetricsState(datasource, languageProvider, true));
      expect(result.current.hasMetrics).toBe(false);
    });

    it('should be true when metrics are available', () => {
      const datasource = createMockDatasource();
      const languageProvider = createMockLanguageProvider(['metric1']);
      const { result } = renderHook(() => useMetricsState(datasource, languageProvider, true));
      expect(result.current.hasMetrics).toBe(true);
    });
  });

  describe('memoization', () => {
    it('should return same values when dependencies have not changed', () => {
      const datasource = createMockDatasource();
      const languageProvider = createMockLanguageProvider(['metric1']);
      const { result, rerender } = renderHook(() => useMetricsState(datasource, languageProvider, true));
      const firstResult = result.current;

      rerender();
      expect(result.current).toBe(firstResult);
    });

    it('should update when datasource lookupsDisabled changes', () => {
      const initialDatasource = createMockDatasource(false);
      const languageProvider = createMockLanguageProvider(['metric1']);
      const { result, rerender } = renderHook(({ ds }) => useMetricsState(ds, languageProvider, true), {
        initialProps: { ds: initialDatasource },
      });
      const firstResult = result.current;

      const updatedDatasource = createMockDatasource(true);
      rerender({ ds: updatedDatasource });
      expect(result.current).not.toBe(firstResult);
    });
  });
});
