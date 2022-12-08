import React, { ReactElement, useMemo } from 'react';

import { HorizontalGroup } from '@grafana/ui';

import { PluginRecipeStep, Screenshot, SetupDashboardStepSettings } from '../types';

type Props = {
  steps: Array<PluginRecipeStep<SetupDashboardStepSettings>>;
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
          <li key={step.name}>{step.description}</li>
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

function useDashboardScreenshots(steps: Array<PluginRecipeStep<SetupDashboardStepSettings>>): Screenshot[] {
  return useMemo(() => {
    return steps.reduce<Screenshot[]>((all, step) => {
      all.push(...step.settings.screenshots);
      return all;
    }, []);
  }, [steps]);
}
