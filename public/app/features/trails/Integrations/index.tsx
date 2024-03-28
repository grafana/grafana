import React, { useMemo } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { getPluginComponentExtensions } from '@grafana/runtime';

import {
  DataTrailsLabelProvider,
  DataTrailsMetricProvider,
  DataTrailsMetricsSortHeuristic,
  DataTrailsRelatedMetricsSortHeuristic,
  ComponentExtensionsProps,
} from './types';
import { useIntegrationContributionReducer } from './useIntegrationContributionReducer';

export function useIntegrations() {
  const [metricSorteHeuristics, addMetricSortHeuristic] =
    useIntegrationContributionReducer<DataTrailsMetricsSortHeuristic>();
  const [relatedMetricSortHeuristics, addRelatedMetricSortHeuristic] =
    useIntegrationContributionReducer<DataTrailsRelatedMetricsSortHeuristic>();
  const [metricProviders, addMetricProvider] = useIntegrationContributionReducer<DataTrailsMetricProvider>();
  const [labelProviders, addLabelProvider] = useIntegrationContributionReducer<DataTrailsLabelProvider>();

  const extensionContainer = useMemo(() => {
    const extensionProps: ComponentExtensionsProps = {
      addMetricSortHeuristic,
      addRelatedMetricSortHeuristic,
      addMetricProvider,
      addLabelProvider,
    };

    const { extensions } = getPluginComponentExtensions<ComponentExtensionsProps>({
      extensionPointId: PluginExtensionPoints.DataTrailsExtension,
    });

    const extensionContainer = (
      <div style={{ display: 'none' }}>
        {extensions.map((extension) => {
          const Component = extension.component;

          return <Component key={extension.id} {...extensionProps} />;
        })}
      </div>
    );
    return extensionContainer;
  }, [addLabelProvider, addMetricProvider, addMetricSortHeuristic, addRelatedMetricSortHeuristic]);

  return {
    extensionContainer,
    metricProviders,
    labelProviders,
    metricSorteHeuristics,
    relatedMetricSortHeuristics,
  };
}
