import { useMemo } from 'react';

import { PrometheusDatasource } from '../datasource';
import PromQlLanguageProvider from '../language_provider';

function getChooserText(metricsLookupDisabled: boolean, hasSyntax: boolean, hasMetrics: boolean) {
  if (metricsLookupDisabled) {
    return '(Disabled)';
  }

  if (!hasSyntax) {
    return 'Loading metrics...';
  }

  if (!hasMetrics) {
    return '(No metrics found)';
  }

  return 'Metrics browser';
}

export function useMetricsState(
  datasource: PrometheusDatasource,
  languageProvider: PromQlLanguageProvider,
  syntaxLoaded: boolean
) {
  return useMemo(() => {
    const hasMetrics = languageProvider.metrics.length > 0;
    const chooserText = getChooserText(datasource.lookupsDisabled, syntaxLoaded, hasMetrics);
    const buttonDisabled = !(syntaxLoaded && hasMetrics);

    return {
      hasMetrics,
      chooserText,
      buttonDisabled,
    };
  }, [languageProvider.metrics, datasource.lookupsDisabled, syntaxLoaded]);
}
