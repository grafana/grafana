import { test, expect } from '@grafana/plugin-e2e';

import testV2Dashboard from '../dashboards/V2DashboardWithTabsForSlugTest.json';

import { flows, importTestDashboard } from './utils';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});
interface UrlObject {
    url?: string;
    row?: UrlObject;
    tab?: UrlObject;
}

function buildUrlForDashboard(dashboardUid: string, object: UrlObject) {
    function buildNestedUrl(obj: UrlObject): string {
        if (obj.row) {
         return    `&${obj.row.url}${buildNestedUrl(obj.row)}`;
        }
        if (obj.tab) {
            return `-dtab=${obj.tab.url}`;
        }
        return ''
    }
    const baseUrl = `/d/${dashboardUid}`;
    const nestedUrl = buildNestedUrl(object);
    return `${baseUrl}?${nestedUrl}`;
}

const testCases: Array<{ description: string; urlObject: UrlObject; expectedSelectedTab: string }> = [
    {
        description: 'selects the correct tab inside a row according to the url parameters',
        urlObject: {
            row: {
                url: 'Overview',
                tab: {
                    url: 'Logs'
                }
            }
        },
        expectedSelectedTab: 'Logs'
    }
]

test.describe(
  'Syncing URL with dashboard state',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('selects the correct tabs according to the url parameters', async ({ dashboardPage, selectors, page }) => {
        const dashboard = testV2Dashboard;
        await importTestDashboard(page, selectors, "test", JSON.stringify(dashboard));
        console.log(page.url());
        const dashId = page.url().match(/\/d\/([^\/]+)/)![1];
        
        const url = buildUrlForDashboard(dashId, {
            row: {
                url: 'Overview',
                tab: {
                    url: 'Logs'
                }
            }
        })
        await page.goto(url);
        await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title(`Logs`))).toHaveAttribute('aria-selected', 'true');
    });
    }
)
