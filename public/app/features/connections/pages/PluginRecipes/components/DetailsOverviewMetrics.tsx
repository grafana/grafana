import React, { ReactElement, useMemo } from 'react';

import { PluginRecipeInstallAgentStep, RecipeMetric } from '../types';

type Props = {
  steps: PluginRecipeInstallAgentStep[];
};

export function DetailsOverviewMetrics({ steps }: Props): ReactElement {
  const { fields, metrics } = useCollectedMetrics(steps);

  return (
    <section>
      <h2>Metrics</h2>
      <hr />
      <p>The following metrics are collected from the server where you install the agent in this recipe.</p>
      <table>
        <thead>
          <tr>
            <th>Metric name</th>
            {fields['type'] && <th>Type</th>}
            {fields['description'] && <th>Description</th>}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric, i) => (
            <tr key={i}>
              <td>{metric.name}</td>
              {fields['type'] && <td>{metric.type}</td>}
              {fields['description'] && <td>{metric.description}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type CollectedMetrics = {
  fields: Record<string, boolean>;
  metrics: RecipeMetric[];
};

function useCollectedMetrics(steps: PluginRecipeInstallAgentStep[]): CollectedMetrics {
  return useMemo(() => {
    return steps.reduce<CollectedMetrics>(
      (result, step) => {
        for (const metric of step.metrics) {
          if (metric.name) {
            result.fields['name'] = true;
          }
          if (metric.description) {
            result.fields['description'] = true;
          }
          if (metric.type) {
            result.fields['type'] = true;
          }
          result.metrics.push(metric);
        }
        return result;
      },
      { fields: {}, metrics: [] }
    );
  }, [steps]);
}
