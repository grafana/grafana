import { Page } from 'puppeteer-core';

import { ClickablePageObjectType } from '../../pageObjects';
import { TestPage } from '../../pageInfo';
import { dashboardPage } from './dashboardPage';
import { dashboardSettingsPage } from './dashboardSettingsPage';
import { saveDashboardModal } from './saveDashboardModal';
import { dashboardsPageFactory } from './dashboardsPage';
import { confirmModal } from '../modals/confirmModal';

export interface CreateDashboardPage {
  addQuery: ClickablePageObjectType;
  saveDashboard: ClickablePageObjectType;
}

export const createDashboardPage = new TestPage<CreateDashboardPage>({
  url: '/dashboard/new',
  pageObjects: {
    addQuery: 'Add Query CTA button',
    saveDashboard: 'Save dashboard navbar button',
  },
});

export const createEmptyDashboardPage = async (page: Page, dashboardTitle: string) => {
  await createDashboardPage.init(page);
  await createDashboardPage.navigateTo();
  await createDashboardPage.pageObjects.saveDashboard.click();

  await saveDashboardModal.init(page);
  await saveDashboardModal.expectSelector({ selector: 'save-dashboard-as-modal' });
  await saveDashboardModal.pageObjects.name.enter(dashboardTitle);
  await saveDashboardModal.pageObjects.save.click();
  await saveDashboardModal.pageObjects.success.exists();

  await dashboardPage.init(page);
  return dashboardPage;
};

export const cleanDashboard = async (page: Page, dashboardTitle: string) => {
  const dashboardsPage = dashboardsPageFactory(dashboardTitle);
  await dashboardsPage.init(page);
  await dashboardsPage.navigateTo();
  await dashboardsPage.pageObjects.dashboard.exists();
  await dashboardsPage.pageObjects.dashboard.click();

  await dashboardPage.init(page);
  await dashboardPage.pageObjects.settings.click();

  await dashboardSettingsPage.init(page);
  await dashboardSettingsPage.pageObjects.deleteDashBoard.click();

  await confirmModal.init(page);
  await confirmModal.pageObjects.delete.click();
  await confirmModal.pageObjects.success.exists();
};
