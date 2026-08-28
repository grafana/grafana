import { act, renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { of } from 'rxjs';

import { type DataSourceInstanceSettings, LoadingState } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';

import { previewAlertRule } from '../../api/preview';
import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { type PreviewRuleResponse } from '../../types/preview';
import { RuleFormType, type RuleFormValues } from '../../types/rule-form';

import { usePreview } from './PreviewRule';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
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

describe('usePreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves the data source before building the cloud preview request', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValue({ uid: 'mimir-uid' } as DataSourceInstanceSettings);
    mockPreviewAlertRule.mockReturnValue(
      of({ data: { state: LoadingState.Done, series: [] } } as unknown as PreviewRuleResponse)
    );

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
    expect(mockPreviewAlertRule).toHaveBeenCalledWith(
      expect.objectContaining({ dataSourceUid: 'mimir-uid', dataSourceName: 'Mimir', expr: 'up == 1' })
    );
  });

  it('rejects when the data source cannot be resolved', async () => {
    mockGetDataSourceInstanceSettings.mockResolvedValue(undefined);

    const { result } = renderUsePreview({ type: RuleFormType.cloudAlerting, dataSourceName: 'unknown' });

    await expect(result.current[1]()).rejects.toThrow(/Cannot find data source settings/);
    expect(mockPreviewAlertRule).not.toHaveBeenCalled();
  });
});
