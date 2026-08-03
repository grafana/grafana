import { type Page } from '@playwright/test';

import {
  test,
  expect,
  type Components,
  type E2ESelectorGroups,
  type DashboardPage,
  type DashboardPageArgs,
} from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/DashboardWithAllConditionalRendering.json';

import { Controls, Panels, Rows, Tabs } from './page-objects';
import { checkRepeatedPanelTitles, fillVariableValue } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
  viewport: { width: 1920, height: 1080 },
});

test.describe('Dashboard - Conditional Rendering - Load and Change', { tag: ['@dashboards'] }, () => {
  let uid: string;

  const loadDashboard = async (
    page: Page,
    gotoDashboardPage: (args: DashboardPageArgs) => Promise<DashboardPage>,
    selectors: E2ESelectorGroups,
    components: Components,
    options?: { from?: string; to?: string; myVariable?: string }
  ) => {
    const params: DashboardPageArgs = { uid };

    if (options?.from && options?.to) {
      params.timeRange = {
        from: options.from,
        to: options.to,
      };
    }

    if (options?.myVariable) {
      params.queryParams = new URLSearchParams();
      params.queryParams.set('var-myVariable', options.myVariable);
    }

    const dashboardPage = await gotoDashboardPage(params);
    await expect(page.getByText(testDashboard.spec.title)).toBeVisible();
    await page.waitForLoadState('networkidle');

    const args = { page, dashboardPage, selectors, components };
    return {
      dashboardPage,
      controls: new Controls(args),
      panels: new Panels(args),
      rows: new Rows(args),
      tabs: new Tabs(args),
    };
  };

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/apis/dashboard.grafana.app/v2beta1/namespaces/stacks-12345/dashboards', {
      data: {
        metadata: {
          annotations: {
            'grafana.app/folder': '',
            'grafana.app/grant-permissions': 'default',
          },
          generateName: 'ad',
        },
        spec: testDashboard.spec,
      },
    });
    const responseBody = await response.json();
    uid = responseBody.metadata.name;
  });

  test.afterAll(async ({ request }) => {
    if (uid) {
      await request.delete(`/apis/dashboard.grafana.app/v1beta1/namespaces/stacks-12345/dashboards/${uid}`);
    }
  });

  test('Load without data', async ({ page, gotoDashboardPage, selectors, components }) => {
    const { dashboardPage, panels } = await loadDashboard(page, gotoDashboardPage, selectors, components);

    await expect(panels.getContainer('Panel - show - data')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - data')).toBeVisible();
    await expect(panels.getContainer('Panel - show - no data')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - no data')).not.toBeVisible();

    await fillVariableValue(page, dashboardPage, selectors, testDashboard.spec.variables[0].spec.name, '1,2,3,4');

    await expect(panels.getContainer('Panel - show - data')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - data')).not.toBeVisible();
    await expect(panels.getContainer('Panel - show - no data')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - no data')).toBeVisible();
  });

  test('Load with data', async ({ page, gotoDashboardPage, selectors, components }) => {
    const { dashboardPage, panels } = await loadDashboard(page, gotoDashboardPage, selectors, components, {
      myVariable: '1,2,3,4',
    });

    await expect(panels.getContainer('Panel - show - data')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - data')).not.toBeVisible();
    await expect(panels.getContainer('Panel - show - no data')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - no data')).toBeVisible();

    await fillVariableValue(page, dashboardPage, selectors, testDashboard.spec.variables[0].spec.name, '');

    await expect(panels.getContainer('Panel - show - data')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - data')).toBeVisible();
    await expect(panels.getContainer('Panel - show - no data')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - no data')).not.toBeVisible();
  });

  test('Load without time range', async ({ page, gotoDashboardPage, selectors, components }) => {
    const { controls, panels, rows, tabs } = await loadDashboard(page, gotoDashboardPage, selectors, components);

    await expect(panels.getContainer('Panel - show - time range <7d')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - time range <7d')).not.toBeVisible();
    await expect(rows.getTitle('Row - show - time range <7d')).toBeVisible();
    await expect(rows.getTitle('Row - hide - time range <7d')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - show - time range <7d')).toBeVisible();
    await expect(tabs.getTitle('Tab - hide - time range <7d')).not.toBeVisible();

    await controls.timeRange.set('now-8d', 'now');
    await page.waitForLoadState('networkidle');

    await expect(panels.getContainer('Panel - show - time range <7d')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - time range <7d')).toBeVisible();
    await expect(rows.getTitle('Row - show - time range <7d')).not.toBeVisible();
    await expect(rows.getTitle('Row - hide - time range <7d')).toBeVisible();
    await expect(tabs.getTitle('Tab - show - time range <7d')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - hide - time range <7d')).toBeVisible();
  });

  test('Load with time range', async ({ page, gotoDashboardPage, selectors, components }) => {
    const { controls, panels, rows, tabs } = await loadDashboard(page, gotoDashboardPage, selectors, components, {
      from: 'now-8d',
      to: 'now',
    });

    await expect(panels.getContainer('Panel - show - time range <7d')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - time range <7d')).toBeVisible();
    await expect(rows.getTitle('Row - show - time range <7d')).not.toBeVisible();
    await expect(rows.getTitle('Row - hide - time range <7d')).toBeVisible();
    await expect(tabs.getTitle('Tab - show - time range <7d')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - hide - time range <7d')).toBeVisible();

    await controls.timeRange.set('now-6h', 'now');
    await page.waitForLoadState('networkidle');

    await expect(panels.getContainer('Panel - show - time range <7d')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - time range <7d')).not.toBeVisible();
    await expect(rows.getTitle('Row - show - time range <7d')).toBeVisible();
    await expect(rows.getTitle('Row - hide - time range <7d')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - show - time range <7d')).toBeVisible();
    await expect(tabs.getTitle('Tab - hide - time range <7d')).not.toBeVisible();
  });

  test('Load without variable equals/not equals', async ({ page, gotoDashboardPage, selectors, components }) => {
    const { dashboardPage, panels, rows, tabs } = await loadDashboard(page, gotoDashboardPage, selectors, components);

    await expect(panels.getContainer('Panel - show - variable - equals 1,2,3')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - equals 1,2,3')).toBeVisible();
    await expect(panels.getContainer('Panel - show - variable - not equals 1,2,3')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - not equals 1,2,3')).not.toBeVisible();
    await expect(rows.getTitle('Row - show - variable - equals 1,2,3')).not.toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - equals 1,2,3')).toBeVisible();
    await expect(rows.getTitle('Row - show - variable - not equals 1,2,3')).toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - not equals 1,2,3')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - equals 1,2,3')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - equals 1,2,3')).toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - not equals 1,2,3')).toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - not equals 1,2,3')).not.toBeVisible();

    await fillVariableValue(page, dashboardPage, selectors, testDashboard.spec.variables[0].spec.name, '1,2,3');

    await expect(panels.getContainer('Panel - show - variable - equals 1,2,3')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - equals 1,2,3')).not.toBeVisible();
    await expect(panels.getContainer('Panel - show - variable - not equals 1,2,3')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - not equals 1,2,3')).toBeVisible();
    await expect(rows.getTitle('Row - show - variable - equals 1,2,3')).toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - equals 1,2,3')).not.toBeVisible();
    await expect(rows.getTitle('Row - show - variable - not equals 1,2,3')).not.toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - not equals 1,2,3')).toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - equals 1,2,3')).toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - equals 1,2,3')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - not equals 1,2,3')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - not equals 1,2,3')).toBeVisible();
  });

  test('Load with variable equals/not equals', async ({ page, gotoDashboardPage, selectors, components }) => {
    const { dashboardPage, panels, rows, tabs } = await loadDashboard(page, gotoDashboardPage, selectors, components, {
      myVariable: '1,2,3',
    });

    await expect(panels.getContainer('Panel - show - variable - equals 1,2,3')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - equals 1,2,3')).not.toBeVisible();
    await expect(panels.getContainer('Panel - show - variable - not equals 1,2,3')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - not equals 1,2,3')).toBeVisible();
    await expect(rows.getTitle('Row - show - variable - equals 1,2,3')).toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - equals 1,2,3')).not.toBeVisible();
    await expect(rows.getTitle('Row - show - variable - not equals 1,2,3')).not.toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - not equals 1,2,3')).toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - equals 1,2,3')).toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - equals 1,2,3')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - not equals 1,2,3')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - not equals 1,2,3')).toBeVisible();

    await fillVariableValue(page, dashboardPage, selectors, testDashboard.spec.variables[0].spec.name, '');

    await expect(panels.getContainer('Panel - show - variable - equals 1,2,3')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - equals 1,2,3')).toBeVisible();
    await expect(panels.getContainer('Panel - show - variable - not equals 1,2,3')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - not equals 1,2,3')).not.toBeVisible();
    await expect(rows.getTitle('Row - show - variable - equals 1,2,3')).not.toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - equals 1,2,3')).toBeVisible();
    await expect(rows.getTitle('Row - show - variable - not equals 1,2,3')).toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - not equals 1,2,3')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - equals 1,2,3')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - equals 1,2,3')).toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - not equals 1,2,3')).toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - not equals 1,2,3')).not.toBeVisible();
  });

  test('Load without variable matches/not matches', async ({ page, gotoDashboardPage, selectors, components }) => {
    const { dashboardPage, panels, rows, tabs } = await loadDashboard(page, gotoDashboardPage, selectors, components);

    await expect(panels.getContainer('Panel - show - variable - matches .*2.*')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - matches .*2.*')).toBeVisible();
    await expect(panels.getContainer('Panel - show - variable - not matches .*2.*')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - not matches .*2.*')).not.toBeVisible();
    await expect(rows.getTitle('Row - show - variable - matches .*2.*')).not.toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - matches .*2.*')).toBeVisible();
    await expect(rows.getTitle('Row - show - variable - not matches .*2.*')).toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - not matches .*2.*')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - matches .*2.*')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - matches .*2.*')).toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - not matches .*2.*')).toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - not matches .*2.*')).not.toBeVisible();

    await fillVariableValue(page, dashboardPage, selectors, testDashboard.spec.variables[0].spec.name, '1,2,3');

    await expect(panels.getContainer('Panel - show - variable - matches .*2.*')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - matches .*2.*')).not.toBeVisible();
    await expect(panels.getContainer('Panel - show - variable - not matches .*2.*')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - not matches .*2.*')).toBeVisible();
    await expect(rows.getTitle('Row - show - variable - matches .*2.*')).toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - matches .*2.*')).not.toBeVisible();
    await expect(rows.getTitle('Row - show - variable - not matches .*2.*')).not.toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - not matches .*2.*')).toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - matches .*2.*')).toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - matches .*2.*')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - not matches .*2.*')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - not matches .*2.*')).toBeVisible();
  });

  test('Load with variable matches/not matches', async ({ page, gotoDashboardPage, selectors, components }) => {
    const { dashboardPage, panels, rows, tabs } = await loadDashboard(page, gotoDashboardPage, selectors, components, {
      myVariable: '1,2,3',
    });

    await expect(panels.getContainer('Panel - show - variable - matches .*2.*')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - matches .*2.*')).not.toBeVisible();
    await expect(panels.getContainer('Panel - show - variable - not matches .*2.*')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - not matches .*2.*')).toBeVisible();
    await expect(rows.getTitle('Row - show - variable - matches .*2.*')).toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - matches .*2.*')).not.toBeVisible();
    await expect(rows.getTitle('Row - show - variable - not matches .*2.*')).not.toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - not matches .*2.*')).toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - matches .*2.*')).toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - matches .*2.*')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - not matches .*2.*')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - not matches .*2.*')).toBeVisible();

    await fillVariableValue(page, dashboardPage, selectors, testDashboard.spec.variables[0].spec.name, '');

    await expect(panels.getContainer('Panel - show - variable - matches .*2.*')).not.toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - matches .*2.*')).toBeVisible();
    await expect(panels.getContainer('Panel - show - variable - not matches .*2.*')).toBeVisible();
    await expect(panels.getContainer('Panel - hide - variable - not matches .*2.*')).not.toBeVisible();
    await expect(rows.getTitle('Row - show - variable - matches .*2.*')).not.toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - matches .*2.*')).toBeVisible();
    await expect(rows.getTitle('Row - show - variable - not matches .*2.*')).toBeVisible();
    await expect(rows.getTitle('Row - hide - variable - not matches .*2.*')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - matches .*2.*')).not.toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - matches .*2.*')).toBeVisible();
    await expect(tabs.getTitle('Tab - show - variable - not matches .*2.*')).toBeVisible();
    await expect(tabs.getTitle('Tab - hide - variable - not matches .*2.*')).not.toBeVisible();
  });

  test.describe('Variable repeat', () => {
    const repeatOptions = ['a', 'b', 'c'];

    async function failTestDataRequestForOption(page: Page, option: string) {
      await page.route(/\/api\/ds\/query\?.*\bds_type=grafana-testdata-datasource/, async (route) => {
        const rawPostData = route.request().postData();
        if (!rawPostData) {
          return;
        }

        // the first panel query has a label set to the current variable value
        if (JSON.parse(rawPostData).queries[0].labels === `key=${option}`) {
          await route.fulfill({ status: 500, body: '{}' });
        } else {
          await route.continue();
        }
      });
    }

    test('Hide when equals, hide when no data', async ({ page, gotoDashboardPage, selectors, components }) => {
      const { dashboardPage, tabs } = await loadDashboard(page, gotoDashboardPage, selectors, components);

      const optionForHiddenPanels = repeatOptions[0];

      await failTestDataRequestForOption(page, optionForHiddenPanels);

      await tabs.getTitle('Tab - repeated items').click();

      await checkRepeatedPanelTitles(
        dashboardPage,
        selectors,
        'Hide panel - ',
        [
          `custom variable equals ${optionForHiddenPanels} (current = ${optionForHiddenPanels})`,
          `no data (current = ${optionForHiddenPanels})`,
        ],
        true
      );

      const optionsForVisiblePanels = repeatOptions.slice(1);

      await checkRepeatedPanelTitles(dashboardPage, selectors, 'Hide panel - ', [
        ...optionsForVisiblePanels.map((o) => `custom variable equals ${optionForHiddenPanels} (current = ${o})`),
        ...optionsForVisiblePanels.map((o) => `no data (current = ${o})`),
      ]);
    });
  });
});
