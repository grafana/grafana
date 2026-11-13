import { HttpResponse, http } from 'msw';
import { type PropsWithChildren } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { act, renderHook, waitFor } from 'test/test-utils';

import { LoadingState } from '@grafana/data';
import server from '@grafana/test-utils/server';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { setupMswServer } from '../../mockApi';
import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { RuleFormType, type RuleFormValues } from '../../types/rule-form';

import { usePreview } from './PreviewRule';

setupMswServer();

interface CapturedRequest {
  dataSourceUid: string;
  body: unknown;
}

function capturePreviewRequests(): CapturedRequest[] {
  const captured: CapturedRequest[] = [];
  server.use(
    http.post<{ uid: string }>('/api/v1/rule/test/:uid', async ({ request, params }) => {
      captured.push({ dataSourceUid: params.uid, body: await request.json() });
      return HttpResponse.json({ instances: [] });
    })
  );
  return captured;
}

function renderUsePreview(values: Partial<RuleFormValues>) {
  function Wrapper({ children }: PropsWithChildren) {
    const form = useForm<RuleFormValues>({ defaultValues: { ...getDefaultFormValues(), ...values } });
    return <FormProvider {...form}>{children}</FormProvider>;
  }

  return renderHook(() => usePreview(), { wrapper: Wrapper });
}

function dataQuery(datasourceUid: string): AlertQuery {
  return {
    refId: 'A',
    datasourceUid,
    queryType: '',
    model: { refId: 'A' },
  };
}

describe('usePreview', () => {
  it('posts a cloud rule preview to the uid of the first query data source', async () => {
    const captured = capturePreviewRequests();
    const { result } = renderUsePreview({
      type: RuleFormType.cloudAlerting,
      dataSourceName: 'Mimir',
      queries: [dataQuery('mimir-uid')],
      expression: 'up == 0',
    });

    act(() => result.current[1]());

    await waitFor(() => expect(result.current[0]?.data.state).toBe(LoadingState.Done));
    expect(captured).toEqual([
      {
        dataSourceUid: 'mimir-uid',
        body: { dataSourceUid: 'mimir-uid', expr: 'up == 0' },
      },
    ]);
  });

  it('posts a Grafana rule preview to the grafana endpoint with the condition and queries', async () => {
    const captured = capturePreviewRequests();
    const queries: AlertQuery[] = [dataQuery('prometheus-uid')];
    const { result } = renderUsePreview({
      type: RuleFormType.grafana,
      dataSourceName: 'grafana',
      condition: 'A',
      queries,
    });

    act(() => result.current[1]());

    await waitFor(() => expect(result.current[0]?.data.state).toBe(LoadingState.Done));
    expect(captured).toHaveLength(1);
    expect(captured[0].dataSourceUid).toBe('grafana');
    expect(captured[0].body).toEqual({
      grafana_condition: { condition: 'A', data: queries, now: expect.any(String) },
    });
  });

  it('throws when the cloud rule has no data source uid in its first query', () => {
    const { result } = renderUsePreview({
      type: RuleFormType.cloudAlerting,
      dataSourceName: 'Mimir',
      queries: [dataQuery('')],
      expression: 'up == 0',
    });

    expect(() => result.current[1]()).toThrow('Cannot find data source settings for Mimir');
  });

  it('throws when the Grafana rule has no condition', () => {
    const { result } = renderUsePreview({
      type: RuleFormType.grafana,
      dataSourceName: 'grafana',
      condition: null,
      queries: [dataQuery('prometheus-uid')],
    });

    expect(() => result.current[1]()).toThrow('Cannot preview a Grafana-managed rule without a condition');
  });
});
