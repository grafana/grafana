import { css } from '@emotion/css';
import React, { ReactElement, useMemo } from 'react';

import { HorizontalGroup, useStyles2 } from '@grafana/ui';

import {
  isSetupDashboardStep,
  PluginRecipe,
  PluginRecipeSetupDashboardStep,
  PluginRecipeStep,
  Screenshot,
} from '../types';

type Props = {
  recipe: PluginRecipe;
};

export function DetailsOverview({ recipe }: Props): ReactElement {
  const styles = useStyles2(getStyles);

  const dashboardSteps = useDashboardSteps(recipe.steps);
  const dashboardScreenshots = useDashboardScreenshots(dashboardSteps);

  return (
    <div className={styles.overview}>
      <section>
        <h2>About</h2>
        <hr />
        <p>{recipe.meta.description}</p>
      </section>
      {dashboardSteps.length > 0 && (
        <section>
          <h2>Dashboards</h2>
          <hr />
          <p>
            The following pre-built dashboards are included in this recipe. You can either use them as they are or
            customize them to your specific needs.
          </p>
          <ul>
            {dashboardSteps.map((step) => (
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
      )}
    </div>
  );
}

function useDashboardSteps(steps: PluginRecipeStep[]): PluginRecipeSetupDashboardStep[] {
  return useMemo(() => {
    return steps.filter<PluginRecipeSetupDashboardStep>(isSetupDashboardStep);
  }, [steps]);
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

const getStyles = () => ({
  overview: css`
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
  `,
});
