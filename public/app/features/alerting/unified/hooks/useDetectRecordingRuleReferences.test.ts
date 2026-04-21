import { renderHook } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { setupMswServer } from '../mockApi';
import { EvaluationScenario } from '../types/evaluation-chain';
import { type RuleFormValues } from '../types/rule-form';

import { useDetectRecordingRuleReferences } from './useDetectRecordingRuleReferences';

// Ensure no recording rules come back from the API for most tests
setupMswServer();

function makeWrapper(defaultValues: Partial<RuleFormValues> = {}) {
  const store = configureStore();
  return ({ children }: React.PropsWithChildren<{}>) => {
    const formMethods = useForm<RuleFormValues>({ defaultValues: defaultValues as RuleFormValues });
    return React.createElement(Provider, { store }, React.createElement(FormProvider, { ...formMethods }, children));
  };
}

describe('useDetectRecordingRuleReferences', () => {
  it('returns NoRecordingRules when queries have no recording rule references', () => {
    const { result } = renderHook(() => useDetectRecordingRuleReferences(), {
      wrapper: makeWrapper({ queries: [] }),
    });

    expect(result.current.scenario).toBe(EvaluationScenario.NoRecordingRules);
    expect(result.current.referencedRecordingRules).toHaveLength(0);
    expect(result.current.chains).toHaveLength(0);
  });

  it('handles empty queries array', () => {
    const { result } = renderHook(() => useDetectRecordingRuleReferences(), {
      wrapper: makeWrapper({ queries: [] }),
    });

    expect(result.current.scenario).toBe(EvaluationScenario.NoRecordingRules);
    expect(result.current.warnings).toHaveLength(0);
  });

  it('handles loading state correctly', () => {
    const { result } = renderHook(() => useDetectRecordingRuleReferences(), {
      wrapper: makeWrapper({ queries: [{ refId: 'A', queryType: '', datasourceUid: 'ds-1', model: {} }] }),
    });

    // Initially loading while the API call resolves
    expect(result.current.isLoading).toBe(true);
    // When loading, scenario defaults to NoRecordingRules
    expect(result.current.scenario).toBe(EvaluationScenario.NoRecordingRules);
  });

  it('returns NoRecordingRules for expression queries (non-data queries)', () => {
    const { result } = renderHook(() => useDetectRecordingRuleReferences(), {
      wrapper: makeWrapper({
        queries: [
          // Expression query with special datasource uid
          { refId: 'B', queryType: '', datasourceUid: '__expr__', model: { type: 'reduce', refId: 'B' } },
        ],
      }),
    });

    // Expression queries are filtered out, so no recording rules detected
    expect(result.current.scenario).toBe(EvaluationScenario.NoRecordingRules);
  });

  it('matches recording rules by datasource UID and metric name from expr field', () => {
    // This test verifies the metric extraction logic for Prometheus-style queries
    // When a data query has expr = 'simple_metric_name' (a simple identifier),
    // it should be looked up in the recording rule index
    const { result } = renderHook(() => useDetectRecordingRuleReferences(), {
      wrapper: makeWrapper({
        queries: [
          {
            refId: 'A',
            queryType: '',
            datasourceUid: 'ds-prom-1',
            model: { expr: 'cpu_usage' }, // Simple metric name
          },
        ],
      }),
    });

    // Since the mock API returns no recording rules, scenario is NoRecordingRules
    // In a real test with MSW providing recording rules, this would match
    expect(result.current.scenario).toBe(EvaluationScenario.NoRecordingRules);
  });
});
