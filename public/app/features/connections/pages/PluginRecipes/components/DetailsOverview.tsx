import { css } from '@emotion/css';
import React, { ReactElement, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import {
  isInstallAgentStep,
  isSetupAlertsStep,
  isSetupDashboardStep,
  PluginRecipe,
  PluginRecipeInstallAgentStep,
  PluginRecipeSetupAlertsStep,
  PluginRecipeSetupDashboardStep,
  PluginRecipeStep,
} from '../types';

import { DetailsOverviewAlerts } from './DetailsOverviewAlerts';
import { DetailsOverviewDashboards } from './DetailsOverviewDashboards';
import { DetailsOverviewMetrics } from './DetailsOverviewMetrics';

type Props = {
  recipe: PluginRecipe;
};

export function DetailsOverview({ recipe }: Props): ReactElement {
  const styles = useStyles2(getStyles);
  const dashboardSteps = useSetupDashboardsSteps(recipe.steps);
  const agentSteps = useInstallAgentSteps(recipe.steps);
  const alertSteps = useSetupAlertsSteps(recipe.steps);

  return (
    <div className={styles.overview}>
      <section>
        <h2>About</h2>
        <hr />
        <p>{recipe.meta.description}</p>
      </section>
      {dashboardSteps.length > 0 && <DetailsOverviewDashboards steps={dashboardSteps} />}
      {agentSteps.length > 0 && <DetailsOverviewMetrics steps={agentSteps} />}
      {alertSteps.length > 0 && <DetailsOverviewAlerts steps={alertSteps} />}
    </div>
  );
}

function useSetupAlertsSteps(steps: PluginRecipeStep[]): PluginRecipeSetupAlertsStep[] {
  return useMemo(() => {
    return steps.filter<PluginRecipeSetupAlertsStep>(isSetupAlertsStep);
  }, [steps]);
}

function useInstallAgentSteps(steps: PluginRecipeStep[]): PluginRecipeInstallAgentStep[] {
  return useMemo(() => {
    return steps.filter<PluginRecipeInstallAgentStep>(isInstallAgentStep);
  }, [steps]);
}

function useSetupDashboardsSteps(steps: PluginRecipeStep[]): PluginRecipeSetupDashboardStep[] {
  return useMemo(() => {
    return steps.filter<PluginRecipeSetupDashboardStep>(isSetupDashboardStep);
  }, [steps]);
}

const getStyles = (theme: GrafanaTheme2) => ({
  overview: css`
    p {
      white-space: pre-wrap;
    }
    hr {
      margin-top: 12px;
    }
    section {
      margin-top: 30px;
    }
    section:first-child {
      margin-top: 14px;
    }
    img {
      max-width: 100%;
      max-height: 100%;
      border: 1px solid rgba(204, 204, 220, 0.15);
      aspect-ratio: 16 / 9;
      object-fit: cover;
    }
    ul {
      padding-left: 25px;
    }
    table {
      font-size: 14px;
      border-collapse: collapse;
      width: 100%;
      margin-top: 12px;
      tbody tr:nth-child(even) {
        background: transparent;
      }
      tbody tr:nth-child(odd) {
        background: ${theme.colors.background.secondary};
      }
      td {
        font-weight: 400;
        font-size: 12px;
      }
      td,
      th {
        &:not(:last-child) {
          width: 200px;
        }
        padding: 10px 8px;
      }
    }
  `,
});
