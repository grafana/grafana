import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { of } from 'rxjs';

import { LoadingState } from '@grafana/data';

import { previewAlertRule } from '../../api/preview';
import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { type PreviewRuleResponse } from '../../types/preview';
import { RuleFormType, type RuleFormValues } from '../../types/rule-form';

import { usePreview } from './PreviewRule';

jest.mock('../../api/preview', () => ({
  previewAlertRule: jest.fn(),
}));

const mockPreviewAlertRule = jest.mocked(previewAlertRule);

function renderUsePreview(formValues: Partial<RuleFormValues>) {
  function Wrapper({ children }: { children: ReactNode }) {
    const formApi = useForm<RuleFormValues>({ defaultValues: { ...getDefaultFormValues(), ...formValues } });
    return <FormProvider {...formApi}>{children}</FormProvider>;
  }

  return renderHook(() => usePreview(), { wrapper: Wrapper });
}

function mockCompletedPreview() {
  mockPreviewAlertRule.mockReturnValue(
    of({ data: { state: LoadingState.Done, series: [] } } as unknown as PreviewRuleResponse)
  );
}

describe('usePreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a cloud preview request with the query data source uid', async () => {
    mockCompletedPreview();

    const { result } = renderUsePreview({
      type: RuleFormType.cloudAlerting,
      condition: 'A',
      expression: 'up == 1',
      queries: [
        {
          refId: 'A',
          queryType: '',
          datasourceUid: 'mimir-uid',
          model: { refId: 'A' },
        },
      ],
    });

    await act(async () => {
      await result.current[1]();
    });

    expect(mockPreviewAlertRule).toHaveBeenCalledWith({
      dataSourceUid: 'mimir-uid',
      expr: 'up == 1',
    });
  });

  it('builds a Grafana preview request with the form condition', async () => {
    mockCompletedPreview();

    const { result } = renderUsePreview({
      type: RuleFormType.grafana,
      condition: 'A',
      queries: [],
    });

    await act(async () => {
      await result.current[1]();
    });

    expect(mockPreviewAlertRule).toHaveBeenCalledWith(
      expect.objectContaining({
        grafana_condition: expect.objectContaining({ condition: 'A', data: [] }),
      })
    );
  });

  it('rejects when the query has no data source uid', async () => {
    const { result } = renderUsePreview({ type: RuleFormType.cloudAlerting, dataSourceName: 'unknown', queries: [] });

    await expect(result.current[1]()).rejects.toThrow('Cannot preview without a data source');
    expect(mockPreviewAlertRule).not.toHaveBeenCalled();
  });
});
