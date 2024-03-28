import { useIntegrations } from '.';

export interface IntegrationContribution {
  id: string;
  label: string;
  description?: string;
}

/** This is intended to be a floating point number from (0..1] where lower values will increase the priority. */
type HeuristicValue = number;
export type HeuristicByMetric = Map<string, HeuristicValue>;

export interface DataTrailsMetricsSortHeuristic extends IntegrationContribution {
  (): Promise<HeuristicByMetric>;
}

export interface DataTrailsRelatedMetricsSortHeuristic extends IntegrationContribution {
  (selectedMetric: string): Promise<HeuristicByMetric>;
}

export interface DataTrailsMetricProvider extends IntegrationContribution {
  (): Promise<string[]>;
}

export interface DataTrailsLabelProvider extends IntegrationContribution {
  (): Promise<string[]>;
}

type Contribute<T extends IntegrationContribution> = (contribution: T) => void;

export type ComponentExtensionsProps = {
  addMetricSortHeuristic: Contribute<DataTrailsMetricsSortHeuristic>;
  addRelatedMetricSortHeuristic: Contribute<DataTrailsRelatedMetricsSortHeuristic>;
  addMetricProvider: Contribute<DataTrailsMetricProvider>;
  addLabelProvider: Contribute<DataTrailsLabelProvider>;
};

export type DataTrailsIntegrations = Omit<ReturnType<typeof useIntegrations>, 'extensionContainer'>;
