import { useState, useEffect } from 'react';
import { AbsoluteTimeRange } from '@grafana/data';
import { CascaderOption } from '@grafana/ui';

import LokiLanguageProvider from 'app/plugins/datasource/loki/language_provider';
import { useRefMounted } from 'app/core/hooks/useRefMounted';

/**
 *
 * @param languageProvider
 * @param languageProviderInitialised
 * @param absoluteRange
 *
 * @description Fetches missing labels and enables labels refresh
 */
export const useLokiLabels = (
  languageProvider: LokiLanguageProvider,
  languageProviderInitialised: boolean,
  absoluteRange: AbsoluteTimeRange
) => {
  const mounted = useRefMounted();

  // State
  const [logLabelOptions, setLogLabelOptions] = useState([]);
  const [shouldTryRefreshLabels, setRefreshLabels] = useState(false);
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
    }
  };

  const tryLabelsRefresh = async () => {
    await languageProvider.refreshLogLabels(absoluteRange);

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
    if (languageProviderInitialised) {
      const targetOption = activeOption[activeOption.length - 1];
      if (targetOption) {
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
    if (languageProviderInitialised) {
      setLogLabelOptions(languageProvider.logLabelOptions);
    }
  }, [languageProviderInitialised]);

  return {
    logLabelOptions,
    refreshLabels: () => setRefreshLabels(true),
    setActiveOption,
  };
};
