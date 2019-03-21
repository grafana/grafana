import { useState, useEffect } from 'react';
import LokiLanguageProvider from 'app/plugins/datasource/loki/language_provider';
import Prism from 'prismjs';

const PRISM_SYNTAX = 'promql';

/**
 *
 * @param languageProvider
 * @description Initializes given language provider, exposes Loki syntax and enables loading label option values
 */
export const useLokiSyntax = (languageProvider: LokiLanguageProvider) => {
  // State
  const [languageProviderInitialised, setLanguageProvideInitilised] = useState(false);
  const [logLabelOptions, setLogLabelOptions] = useState([]);
  const [syntax, setSyntax] = useState(null);
  /**
   * Holds information about currently selected option from rc-cascader to perform effect
   * that loads option values not fetched yet
   */
  const [activeOption, setActiveOption] = useState([]);

  // Async
  const initialiseLanguageProvider = async () => {
    if (!languageProviderInitialised) {
      await languageProvider.start();
    }
    Prism.languages[PRISM_SYNTAX] = languageProvider.getSyntax();
    setLogLabelOptions(languageProvider.logLabelOptions);
    setSyntax(languageProvider.getSyntax());
    setLanguageProvideInitilised(true);
  };

  const fetchOptionValues = async option => {
    await languageProvider.fetchLabelValues(option);
    setLogLabelOptions(languageProvider.logLabelOptions);
  };

  // Effects
  useEffect(() => {
    initialiseLanguageProvider();
  }, []);

  useEffect(() => {
    if (languageProviderInitialised) {
      const targetOption = activeOption[activeOption.length - 1];
      const nextOptions = logLabelOptions.map(option => {
        if (option.value === targetOption.value) {
          return {
            ...option,
            loading: true,
          };
        }
        return option;
      });
      setLogLabelOptions(nextOptions); // to set loading
      fetchOptionValues(targetOption.value);
    }
  }, [activeOption]);

  return {
    isSyntaxReady: languageProviderInitialised,
    syntax,
    logLabelOptions,
    setActiveOption,
  };
};
