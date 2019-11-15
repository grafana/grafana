import {
  ClickablePageObjectType,
  InputPageObjectType,
  PageObjectType,
  Selector,
  SelectPageObjectType,
  SwitchPageObjectType,
  TestPage,
} from '@grafana/toolkit/src/e2e';

export interface VariablePage {
  headerLink: ClickablePageObjectType;
  modeLabel: PageObjectType;
  generalNameInput: InputPageObjectType;
  generalTypeSelect: SelectPageObjectType;
  generalLabelInput: InputPageObjectType;
  generalHideSelect: SelectPageObjectType;
  queryOptionsDataSourceSelect: SelectPageObjectType;
  queryOptionsRefreshSelect: SelectPageObjectType;
  queryOptionsRegExInput: InputPageObjectType;
  queryOptionsSortSelect: SelectPageObjectType;
  queryOptionsQueryInput: InputPageObjectType;
  selectionOptionsMultiSwitch: SwitchPageObjectType;
  selectionOptionsIncludeAllSwitch: SwitchPageObjectType;
  selectionOptionsCustomAllInput: InputPageObjectType;
  valueGroupsTagsEnabledSwitch: SwitchPageObjectType;
  valueGroupsTagsTagsQueryInput: InputPageObjectType;
  valueGroupsTagsTagsValuesQueryInput: InputPageObjectType;
  previewOfValuesOption: PageObjectType;
  addButton: ClickablePageObjectType;
  updateButton: ClickablePageObjectType;
}

export const variablePage = new TestPage<VariablePage>({
  pageObjects: {
    headerLink: 'Variable editor Header link',
    modeLabel: 'Variable editor Header mode New',
    generalNameInput: 'Variable editor Form Name field',
    generalTypeSelect: 'Variable editor Form Type select',
    generalLabelInput: 'Variable editor Form Label field',
    generalHideSelect: 'Variable editor Form Hide select',
    queryOptionsDataSourceSelect: 'Variable editor Form Query DataSource select',
    queryOptionsRefreshSelect: 'Variable editor Form Query Refresh select',
    queryOptionsRegExInput: 'Variable editor Form Query RegEx field',
    queryOptionsSortSelect: 'Variable editor Form Query Sort select',
    queryOptionsQueryInput: 'Variable editor Form Default Variable Query Editor textarea',
    selectionOptionsMultiSwitch: () => Selector.fromSwitchLabel('Variable editor Form Multi switch'),
    selectionOptionsIncludeAllSwitch: () => Selector.fromSwitchLabel('Variable editor Form IncludeAll switch'),
    selectionOptionsCustomAllInput: 'Variable editor Form IncludeAll field',
    valueGroupsTagsEnabledSwitch: () => Selector.fromSwitchLabel('Variable editor Form Query UseTags switch'),
    valueGroupsTagsTagsQueryInput: 'Variable editor Form Query TagsQuery field',
    valueGroupsTagsTagsValuesQueryInput: 'Variable editor Form Query TagsValuesQuery field',
    previewOfValuesOption: 'Variable editor Preview of Values option',
    addButton: 'Variable editor Add button',
    updateButton: 'Variable editor Update button',
  },
});
