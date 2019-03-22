import { renderHook, act } from 'react-hooks-testing-library';
import LanguageProvider from 'app/plugins/datasource/loki/language_provider';
import { useLokiSyntax } from './useLokiSyntax';
import { CascaderOption } from 'app/plugins/datasource/loki/components/LokiQueryFieldForm';

describe('useLokiSyntax hook', () => {
  const datasource = {
    metadataRequest: () => ({ data: { data: [] } }),
  };
  const languageProvider = new LanguageProvider(datasource);
  const logLabelOptionsMock = ['Holy mock!'];
  const logLabelOptionsMock2 = ['Mock the hell?!'];
  const logLabelOptionsMock3 = ['Oh my mock!'];

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
    const { result, waitForNextUpdate } = renderHook(() => useLokiSyntax(languageProvider));
    expect(result.current.syntax).toEqual(null);

    await waitForNextUpdate();

    expect(result.current.syntax).toEqual(languageProvider.getSyntax());
  });

  it('should fetch labels on first call', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useLokiSyntax(languageProvider));
    expect(result.current.isSyntaxReady).toBeFalsy();
    expect(result.current.logLabelOptions).toEqual([]);

    await waitForNextUpdate();

    expect(result.current.isSyntaxReady).toBeTruthy();
    expect(result.current.logLabelOptions).toEqual(logLabelOptionsMock2);
  });

  it('should try to fetch missing options when active option changes', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useLokiSyntax(languageProvider));
    await waitForNextUpdate();
    expect(result.current.logLabelOptions).toEqual(logLabelOptionsMock2);

    languageProvider.fetchLabelValues = (key: string) => {
      languageProvider.logLabelOptions = logLabelOptionsMock3;
      return Promise.resolve();
    };

    act(() => result.current.setActiveOption([activeOptionMock]));

    await waitForNextUpdate();

    expect(result.current.logLabelOptions).toEqual(logLabelOptionsMock3);
  });
});
