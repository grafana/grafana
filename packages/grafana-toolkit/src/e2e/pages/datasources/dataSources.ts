import { Page } from 'puppeteer-core';

import { ClickablePageObjectType } from '../../pageObjects';
import { TestPage } from '../../pageInfo';
import { editDataSourcePage } from './editDataSourcePage';
import { addDataSourcePage } from './addDataSourcePage';
import { confirmModal } from '../modals/confirmModal';

export interface DataSourcesPage {
  testData: ClickablePageObjectType;
}

export const dataSourcesPageFactory = (testDataSourceName: string) =>
  new TestPage<DataSourcesPage>({
    url: '/datasources',
    pageObjects: {
      testData: `Data source list item for ${testDataSourceName}`,
    },
  });

export const addTestDataSourceAndVerify = async (page: Page) => {
  // Add TestData DB
  const testDataSourceName = `e2e - TestData-${new Date().getTime()}`;
  await addDataSourcePage.init(page);
  await addDataSourcePage.navigateTo();
  await addDataSourcePage.pageObjects.testDataDB.exists();
  await addDataSourcePage.pageObjects.testDataDB.click();

  await editDataSourcePage.init(page);
  await editDataSourcePage.waitForNavigation();
  await editDataSourcePage.pageObjects.name.enter(testDataSourceName);
  await editDataSourcePage.pageObjects.saveAndTest.click();
  await editDataSourcePage.pageObjects.alert.exists();
  await editDataSourcePage.pageObjects.alertMessage.containsText('Data source is working');

  // Verify that data source is listed
  const url = await editDataSourcePage.getUrlWithoutBaseUrl();
  const expectedUrl = url.substring(1, url.length - 1);
  const selector = `a[href="${expectedUrl}"]`;

  const dataSourcesPage = dataSourcesPageFactory(testDataSourceName);
  await dataSourcesPage.init(page);
  await dataSourcesPage.navigateTo();
  await dataSourcesPage.expectSelector({ selector });

  return testDataSourceName;
};

export const cleanUpTestDataSource = async (page: Page, testDataSourceName: string) => {
  const dataSourcesPage = dataSourcesPageFactory(testDataSourceName);
  await dataSourcesPage.init(page);
  await dataSourcesPage.navigateTo();
  await dataSourcesPage.pageObjects.testData.click();

  await editDataSourcePage.init(page);
  await editDataSourcePage.pageObjects.delete.exists();
  await editDataSourcePage.pageObjects.delete.click();

  await confirmModal.init(page);
  await confirmModal.pageObjects.delete.click();
  await confirmModal.pageObjects.success.exists();
};
