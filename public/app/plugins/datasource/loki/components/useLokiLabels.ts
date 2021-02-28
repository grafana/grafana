import { useState, useEffect } from 'react';
import { isEqual } from 'lodash';
import { AbsoluteTimeRange } from '@grafana/data';
import { CascaderOption } from '@grafana/ui';

import LokiLanguageProvider from 'app/plugins/datasource/loki/language_provider';
import { useRefMounted } from 'app/core/hooks/useRefMounted';

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
 *
 * @param languageProvider
 * @param languageProviderInitialized
 * @param absoluteRange
 *
 * @description Fetches missing labels and enables labels refresh
 */
export const getLokiLabels = (
  languageProvider: LokiLanguageProvider,
  languageProviderInitialized: boolean,
  absoluteRange: AbsoluteTimeRange
) => {
  const mounted = useRefMounted();

  // State
  const [logLabelOptions, setLogLabelOptions] = useState<any>([]);
  const [labelsLoaded, setLabelsLoaded] = useState(false);
  const [shouldTryRefreshLabels, setRefreshLabels] = useState(false);
  const [prevAbsoluteRange, setPrevAbsoluteRange] = useState<AbsoluteTimeRange | null>(null);
  /**
   * Holds information about currently selected option from rc-cascader to perform effect
   * that loads option values not fetched yet. Based on that useLokiLabels hook decides whether or not
   * the option requires additional data fetching
   */
  const [activeOption, setActiveOption] = useState<CascaderOption[]>([]);

  // Async
  const fetchOptionValues = async (option: string) => {
    await languageProvider.fetchLabelValues(option, absoluteRange);
    if (mounted.current) {
      setLogLabelOptions(languageProvider.logLabelOptions);
      setLabelsLoaded(true);
    }
  };

  const tryLabelsRefresh = async () => {
    await languageProvider.refreshLogLabels(absoluteRange, !isEqual(absoluteRange, prevAbsoluteRange));
    setPrevAbsoluteRange(absoluteRange);

    if (mounted.current) {
      setRefreshLabels(false);
      setLogLabelOptions(languageProvider.logLabelOptions);
    }
  };

  // Effects

  // This effect performs loading of options that hasn't been loaded yet
  // It's a subject of activeOption state change only. This is because of specific behavior or rc-cascader
  // https://github.com/react-component/cascader/blob/master/src/Cascader.jsx#L165
  useEffect(() => {
    if (languageProviderInitialized) {
      const targetOption = activeOption[activeOption.length - 1];
      if (targetOption) {
        const nextOptions = logLabelOptions.map((option: any) => {
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
    }
  }, [activeOption]);

  // This effect is performed on shouldTryRefreshLabels state change only.
  // Since shouldTryRefreshLabels is reset AFTER the labels are refreshed we are secured in case of trying to refresh
  // when previous refresh hasn't finished yet
  useEffect(() => {
    if (shouldTryRefreshLabels) {
      tryLabelsRefresh();
    }
  }, [shouldTryRefreshLabels]);

  // Initialize labels from the provider after it gets initialized (it's initialisation happens outside of this hook)
  useEffect(() => {
    if (languageProviderInitialized) {
      setLogLabelOptions(languageProvider.logLabelOptions);
      setLabelsLoaded(true);
    }
  }, [languageProviderInitialized]);

  return {
    logLabelOptions,
    refreshLabels: () => setRefreshLabels(true),
    setActiveOption,
    labelsLoaded,
  };
};

/**
 * Initializes given language provider and enables loading label option values
 */
export const useLokiLabels = (languageProvider: LokiLanguageProvider, absoluteRange: AbsoluteTimeRange) => {
  const languageProviderInitialized = useInitLanguageProvider(languageProvider, absoluteRange);
  const { logLabelOptions, refreshLabels, setActiveOption, labelsLoaded } = getLokiLabels(
    languageProvider,
    languageProviderInitialized,
    absoluteRange
  );

  return {
    logLabelOptions,
    refreshLabels,
    setActiveOption,
    labelsLoaded,
  };
};
