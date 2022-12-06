import React, { ReactElement, useMemo } from 'react';

import { HorizontalGroup } from '@grafana/ui';

import { PluginRecipeSetupDashboardStep, Screenshot } from '../types';

type Props = {
  steps: PluginRecipeSetupDashboardStep[];
};

export function DetailsOverviewDashboards({ steps }: Props): ReactElement {
  const dashboardScreenshots = useDashboardScreenshots(steps);
  return (
    <section>
      <h2>Dashboards</h2>
      <hr />
      <p>
        The following pre-built dashboards are included in this recipe. You can either use them as they are or customize
        them to your specific needs.
      </p>
      <ul>
        {steps.map((step) => (
          <li key={step.meta?.name}>{step.meta?.description}</li>
        ))}
      </ul>
      {dashboardScreenshots.length > 0 && (
        <section>
          <HorizontalGroup>
            {dashboardScreenshots.map((screenshot) => (
              <img key={screenshot.name} src={screenshot.url} alt={screenshot.name} />
            ))}
          </HorizontalGroup>
        </section>
      )}
    </section>
  );
}

function useDashboardScreenshots(steps: PluginRecipeSetupDashboardStep[]): Screenshot[] {
  return useMemo(() => {
    return steps.reduce<Screenshot[]>((all, step) => {
      if (step.meta?.screenshots) {
        all.push(...step.meta?.screenshots);
      }
      return all;
    }, []);
  }, [steps]);
}
