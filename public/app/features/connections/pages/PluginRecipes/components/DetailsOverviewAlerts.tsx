import React, { ReactElement, useMemo } from 'react';

import { PluginRecipeStep, RecipeAlertRule, SetupAlertsStepSettings } from '../types';

type Props = {
  steps: Array<PluginRecipeStep<SetupAlertsStepSettings>>;
};

export function DetailsOverviewAlerts({ steps }: Props): ReactElement {
  const { fields, alerts } = useConfiguredAlerts(steps);

  return (
    <section>
      <h2>Alerts</h2>
      <hr />
      <p>The following alerts are automatically setup for you when installing this recipe.</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            {fields['summary'] && <th>Summary</th>}
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert, i) => (
            <tr key={i}>
              <td>{alert.name}</td>
              {fields['summary'] && <td>{alert.summary}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type ConfiguredAlerts = {
  fields: Record<string, boolean>;
  alerts: RecipeAlertRule[];
};

function useConfiguredAlerts(steps: Array<PluginRecipeStep<SetupAlertsStepSettings>>): ConfiguredAlerts {
  return useMemo(() => {
    return steps.reduce<ConfiguredAlerts>(
      (result, step) => {
        for (const alert of step.settings.alerts) {
          if (alert.name) {
            result.fields['name'] = true;
          }
          if (alert.summary) {
            result.fields['summary'] = true;
          }
          result.alerts.push(alert);
        }
        return result;
      },
      { fields: {}, alerts: [] }
    );
  }, [steps]);
}
