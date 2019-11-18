import { ArrayPageObjectType, ClickablePageObjectType, PageObjectType, TestPage } from '@grafana/toolkit/src/e2e';

export interface DashboardPage {
  settings: ClickablePageObjectType;
  submenuItemLabel: ArrayPageObjectType;
  submenuItemValueDropDownValueLink: ClickablePageObjectType;
  submenuItemValueDropDownDropDown: PageObjectType;
  submenuItemValueDropDownSelectedLink: PageObjectType;
  submenuItemValueDropDownOptionText: ArrayPageObjectType;
}

export const dashboardPage = new TestPage<DashboardPage>({
  pageObjects: {
    settings: 'Dashboard settings navbar button',
    submenuItemLabel: 'Dashboard template variables submenu LabelName label',
    submenuItemValueDropDownValueLink: 'Dashboard template variables Variable Value DropDown value link',
    submenuItemValueDropDownDropDown: 'Dashboard template variables Variable Value DropDown DropDown',
    submenuItemValueDropDownSelectedLink: 'Dashboard template variables Variable Value DropDown Selected link',
    submenuItemValueDropDownOptionText: 'Dashboard template variables Variable Value DropDown option text',
  },
});
