import { renderHook, act } from 'react-hooks-testing-library';
import LanguageProvider from 'app/plugins/datasource/loki/language_provider';
import { useLokiLabels } from './useLokiLabels';

describe('useLokiLabels hook', () => {
  const datasource = {
    metadataRequest: () => ({ data: { data: [] } }),
  };
  const languageProvider = new LanguageProvider(datasource);
  const logLabelOptionsMock = ['Holy mock!'];

  languageProvider.refreshLogLabels = () => {
    languageProvider.logLabelOptions = logLabelOptionsMock;
    return Promise.resolve();
  };

  it('should refresh labels', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useLokiLabels(languageProvider, true, []));
    act(() => result.current.refreshLabels());
    expect(result.current.logLabelOptions).toEqual([]);
    await waitForNextUpdate();
    expect(result.current.logLabelOptions).toEqual(logLabelOptionsMock);
  });
});
