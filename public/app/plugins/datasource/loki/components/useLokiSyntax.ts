import { useState, useEffect } from 'react';
// @ts-ignore
import Prism from 'prismjs';
import { DataSourceStatus } from '@grafana/ui/src/types/datasource';

import LokiLanguageProvider from 'app/plugins/datasource/loki/language_provider';
import { useLokiLabels } from 'app/plugins/datasource/loki/components/useLokiLabels';
import { CascaderOption } from 'app/plugins/datasource/loki/components/LokiQueryFieldForm';
import { useRefMounted } from 'app/core/hooks/useRefMounted';

const PRISM_SYNTAX = 'promql';

/**
 *
 * @param languageProvider
 * @description Initializes given language provider, exposes Loki syntax and enables loading label option values
 */
export const useLokiSyntax = (languageProvider: LokiLanguageProvider, datasourceStatus: DataSourceStatus) => {
  const mounted = useRefMounted();
  // State
  const [languageProviderInitialized, setLanguageProviderInitilized] = useState(false);
  const [syntax, setSyntax] = useState(null);

  /**
   * Holds information about currently selected option from rc-cascader to perform effect
   * that loads option values not fetched yet. Based on that useLokiLabels hook decides whether or not
   * the option requires additional data fetching
   */
  const [activeOption, setActiveOption] = useState<CascaderOption[]>();

  const { logLabelOptions, setLogLabelOptions, refreshLabels } = useLokiLabels(
    languageProvider,
    languageProviderInitialized,
    activeOption,
    datasourceStatus
  );

  // Async
  const initializeLanguageProvider = async () => {
    await languageProvider.start();
    Prism.languages[PRISM_SYNTAX] = languageProvider.getSyntax();
    if (mounted.current) {
      setLogLabelOptions(languageProvider.logLabelOptions);
      setSyntax(languageProvider.getSyntax());
      setLanguageProviderInitilized(true);
    }
  };

  // Effects
  useEffect(() => {
    initializeLanguageProvider();
  }, []);

  return {
    isSyntaxReady: languageProviderInitialized,
    syntax,
    logLabelOptions,
    setActiveOption,
    refreshLabels,
  };
};
