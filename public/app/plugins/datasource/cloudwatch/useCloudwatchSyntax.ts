import { useState, useEffect } from 'react';
import Prism, { Grammar } from 'prismjs';
import { AbsoluteTimeRange } from '@grafana/data';
import { useRefMounted } from 'app/core/hooks/useRefMounted';
import { CloudWatchLanguageProvider } from './language_provider';

const PRISM_SYNTAX = 'cloudwatch';

/**
 * Initialise the language provider. Returns a languageProviderInitialized boolean cause there does not seem other way
 * to know if the provider is already initialised or not. By the initialisation it modifies the provided
 * languageProvider directly.
 */
const useInitLanguageProvider = (languageProvider: CloudWatchLanguageProvider, absoluteRange: AbsoluteTimeRange) => {
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
const useCloudwatchSyntax = (languageProvider: CloudWatchLanguageProvider, languageProviderInitialized: boolean) => {
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
export const useCloudWatchSyntax = (languageProvider: CloudWatchLanguageProvider, absoluteRange: AbsoluteTimeRange) => {
  const languageProviderInitialized = useInitLanguageProvider(languageProvider, absoluteRange);
  const { isSyntaxReady, syntax } = useCloudwatchSyntax(languageProvider, languageProviderInitialized);

  return {
    isSyntaxReady,
    syntax,
  };
};
