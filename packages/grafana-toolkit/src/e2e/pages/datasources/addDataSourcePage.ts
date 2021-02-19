import { ClickablePageObjectType } from '../../pageObjects';
import { TestPage } from '../../pageInfo';

export interface AddDataSourcePage {
  testDataDB: ClickablePageObjectType;
}

export const addDataSourcePage = new TestPage<AddDataSourcePage>({
  url: '/datasources/new',
  pageObjects: {
    testDataDB: 'TestData DB datasource plugin',
  },
});
