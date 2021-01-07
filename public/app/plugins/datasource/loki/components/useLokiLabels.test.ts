import { renderHook, act } from '@testing-library/react-hooks';
import LanguageProvider from 'app/plugins/datasource/loki/language_provider';
import { getLokiLabels, useLokiLabels } from './useLokiLabels';
import { AbsoluteTimeRange } from '@grafana/data';
import { makeMockLokiDatasource } from '../mocks';
import { CascaderOption } from '@grafana/ui';

// Mocks
const datasource = makeMockLokiDatasource({});
const languageProvider = new LanguageProvider(datasource);

const logLabelOptionsMock = ['Holy mock!'];
const logLabelOptionsMock2 = ['Mock the hell?!'];
const logLabelOptionsMock3 = ['Oh my mock!'];

const rangeMock: AbsoluteTimeRange = {
  from: 1560153109000,
  to: 1560153109000,
};

describe('getLokiLabels hook', () => {
  it('should refresh labels', async () => {
    languageProvider.logLabelOptions = ['initial'];

    languageProvider.refreshLogLabels = () => {
      languageProvider.logLabelOptions = logLabelOptionsMock;
      return Promise.resolve();
    };

    const { result, waitForNextUpdate } = renderHook(() => getLokiLabels(languageProvider, true, rangeMock));
    expect(result.current.logLabelOptions).toEqual(['initial']);
    act(() => result.current.refreshLabels());
    await waitForNextUpdate();
    expect(result.current.logLabelOptions).toEqual(logLabelOptionsMock);
  });
});

describe('useLokiLabels hook', () => {
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

  it('should fetch labels on first call', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useLokiLabels(languageProvider, rangeMock));
    expect(result.current.logLabelOptions).toEqual([]);

    await waitForNextUpdate();

    expect(result.current.logLabelOptions).toEqual(logLabelOptionsMock2);
  });

  it('should try to fetch missing options when active option changes', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useLokiLabels(languageProvider, rangeMock));
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

  it('should refresh labels', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useLokiLabels(languageProvider, rangeMock));

    expect(result.current.logLabelOptions).toEqual([]);

    act(() => result.current.refreshLabels());
    await waitForNextUpdate();

    expect(result.current.logLabelOptions).toEqual(logLabelOptionsMock);
  });
});
