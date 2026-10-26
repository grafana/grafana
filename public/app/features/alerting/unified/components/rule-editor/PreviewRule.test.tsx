import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { of } from 'rxjs';

import { type DataSourceInstanceSettings, LoadingState } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime';

import { previewAlertRule } from '../../api/preview';
import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { type PreviewRuleResponse } from '../../types/preview';
import { RuleFormType, type RuleFormValues } from '../../types/rule-form';

import { usePreview } from './PreviewRule';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceSettings: jest.fn(),
}));

jest.mock('../../api/preview', () => ({
  previewAlertRule: jest.fn(),
}));

const mockGetDataSourceInstanceSettings = jest.mocked(getDataSourceInstanceSettings);
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

  it('resolves the data source before building a cloud preview request', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValue({ uid: 'mimir-uid' } as DataSourceInstanceSettings);
    mockCompletedPreview();

    const { result } = renderUsePreview({
      type: RuleFormType.cloudAlerting,
      dataSourceName: 'Mimir',
      condition: 'A',
      expression: 'up == 1',
    });

    await act(async () => {
      await result.current[1]();
    });

    expect(mockGetDataSourceInstanceSettings).toHaveBeenCalledWith('Mimir');
    expect(mockPreviewAlertRule).toHaveBeenCalledWith({
      dataSourceUid: 'mimir-uid',
      dataSourceName: 'Mimir',
      expr: 'up == 1',
    });
  });

  it('builds a Grafana preview request with the form condition', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValue({ uid: 'grafana' } as DataSourceInstanceSettings);
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

  it('rejects when the data source cannot be resolved', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValue(undefined);

    const { result } = renderUsePreview({ type: RuleFormType.cloudAlerting, dataSourceName: 'unknown' });

    await expect(result.current[1]()).rejects.toThrow(/Cannot find data source settings/);
    expect(mockPreviewAlertRule).not.toHaveBeenCalled();
  });

});
