import { ArrayPageObjectType, ClickablePageObjectType, PageObjectType } from '../../pageObjects';
import { TestPage } from '../../pageInfo';

export interface DashboardPage {
  settings: ClickablePageObjectType;
  submenuItemLabel: ArrayPageObjectType;
  submenuItemValueDropDownValueLink: ArrayPageObjectType;
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

export interface AssertVariableLabelsAndComponentsArguments {
  label: string;
  options: string[];
}

export const assertVariableLabelsAndComponents = async (
  page: TestPage<DashboardPage>,
  args: AssertVariableLabelsAndComponentsArguments[]
) => {
  console.log('Asserting variable components and labels');
  await page.pageObjects.submenuItemLabel.waitForSelector();
  await page.pageObjects.submenuItemLabel.hasLength(args.length);
  await page.pageObjects.submenuItemValueDropDownValueLink.hasLength(args.length);

  for (let index = 0; index < args.length; index++) {
    const { label, options } = args[index];
    await page.pageObjects.submenuItemLabel.containsTextAtPos(label, index);
    await page.pageObjects.submenuItemValueDropDownValueLink.containsTextAtPos(options[1], index);
    await page.pageObjects.submenuItemValueDropDownValueLink.clickAtPos(index);
    await page.pageObjects.submenuItemValueDropDownOptionText.hasLength(options.length);
    for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
      await page.pageObjects.submenuItemValueDropDownOptionText.containsTextAtPos(options[optionIndex], optionIndex);
    }
  }
  console.log('Asserting variable components and labels, Ok');
};
