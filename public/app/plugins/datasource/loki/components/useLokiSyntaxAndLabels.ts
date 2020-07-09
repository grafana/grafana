import { useState, useEffect } from 'react';
import Prism, { Grammar } from 'prismjs';
import { AbsoluteTimeRange } from '@grafana/data';
import LokiLanguageProvider from 'app/plugins/datasource/loki/language_provider';
import { useLokiLabels } from 'app/plugins/datasource/loki/components/useLokiLabels';
import { useRefMounted } from 'app/core/hooks/useRefMounted';

const PRISM_SYNTAX = 'promql';

/**
 * Initialise the language provider. Returns a languageProviderInitialized boolean cause there does not seem other way
 * to know if the provider is already initialised or not. By the initialisation it modifies the provided
 * languageProvider directly.
 */
const useInitLanguageProvider = (languageProvider: LokiLanguageProvider, absoluteRange: AbsoluteTimeRange) => {
  const mounted = useRefMounted();

  const [languageProviderInitialized, setLanguageProviderInitialized] = useState(false);

  // Async
  const initializeLanguageProvider = async () => {
    languageProvider.initialRange = absoluteRange;
    await languageProvider.start();
    if (mounted.current) {
      setLanguageProviderInitialized(true);
    }
  };

  useEffect(() => {
    initializeLanguageProvider();
  }, []);

  return languageProviderInitialized;
};

/**
 * Returns syntax from languageProvider and initialises global Prism syntax. Waits until languageProvider itself is
 * initialised (outside of this hook).
 */
const useLokiSyntax = (languageProvider: LokiLanguageProvider, languageProviderInitialized: boolean) => {
  // State
  const [syntax, setSyntax] = useState<Grammar | null>(null);

  // Effects
  useEffect(() => {
    if (languageProviderInitialized) {
      const syntax = languageProvider.getSyntax();
      Prism.languages[PRISM_SYNTAX] = syntax;
      setSyntax(syntax);
    }
  }, [languageProviderInitialized, languageProvider]);

  return {
    isSyntaxReady: !!syntax,
    syntax,
  };
};

/**
 * Initializes given language provider, exposes Loki syntax and enables loading label option values
 */
export const useLokiSyntaxAndLabels = (languageProvider: LokiLanguageProvider, absoluteRange: AbsoluteTimeRange) => {
  const languageProviderInitialized = useInitLanguageProvider(languageProvider, absoluteRange);

  const { logLabelOptions, refreshLabels, setActiveOption } = useLokiLabels(
    languageProvider,
    languageProviderInitialized,
    absoluteRange
  );
  const { isSyntaxReady, syntax } = useLokiSyntax(languageProvider, languageProviderInitialized);

  return {
    isSyntaxReady,
    syntax,
    logLabelOptions,
    setActiveOption,
    refreshLabels,
  };
};
