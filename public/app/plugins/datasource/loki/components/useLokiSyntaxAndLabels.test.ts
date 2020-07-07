import { renderHook, act } from '@testing-library/react-hooks';
import { AbsoluteTimeRange } from '@grafana/data';
import { CascaderOption } from '@grafana/ui';

import LanguageProvider from 'app/plugins/datasource/loki/language_provider';

import { useLokiSyntaxAndLabels } from './useLokiSyntaxAndLabels';
import { makeMockLokiDatasource } from '../mocks';

describe('useLokiSyntax hook', () => {
  const datasource = makeMockLokiDatasource({});
  const languageProvider = new LanguageProvider(datasource);
  const logLabelOptionsMock = ['Holy mock!'];
  const logLabelOptionsMock2 = ['Mock the hell?!'];
  const logLabelOptionsMock3 = ['Oh my mock!'];

  const rangeMock: AbsoluteTimeRange = {
    from: 1560153109000,
    to: 1560163909000,
  };

  languageProvider.refreshLogLabels = () => {
    languageProvider.logLabelOptions = logLabelOptionsMock;
    return Promise.resolve();
  };

  languageProvider.fetchLogLabels = () => {
    languageProvider.logLabelOptions = logLabelOptionsMock2;
    return Promise.resolve([]);
  };

  const activeOptionMock: CascaderOption = {
    label: '',
    value: '',
  };

  it('should provide Loki syntax when used', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useLokiSyntaxAndLabels(languageProvider, rangeMock));
    expect(result.current.syntax).toEqual(null);

    await waitForNextUpdate();

    expect(result.current.syntax).toEqual(languageProvider.getSyntax());
  });

  it('should fetch labels on first call', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useLokiSyntaxAndLabels(languageProvider, rangeMock));
    expect(result.current.isSyntaxReady).toBeFalsy();
    expect(result.current.logLabelOptions).toEqual([]);

    await waitForNextUpdate();

    expect(result.current.isSyntaxReady).toBeTruthy();
    expect(result.current.logLabelOptions).toEqual(logLabelOptionsMock2);
  });

  it('should try to fetch missing options when active option changes', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useLokiSyntaxAndLabels(languageProvider, rangeMock));
    await waitForNextUpdate();
    expect(result.current.logLabelOptions).toEqual(logLabelOptionsMock2);

    languageProvider.fetchLabelValues = (key: string, absoluteRange: AbsoluteTimeRange) => {
      languageProvider.logLabelOptions = logLabelOptionsMock3;
      return Promise.resolve([]);
    };

    act(() => result.current.setActiveOption([activeOptionMock]));

    await waitForNextUpdate();

    expect(result.current.logLabelOptions).toEqual(logLabelOptionsMock3);
  });
});
