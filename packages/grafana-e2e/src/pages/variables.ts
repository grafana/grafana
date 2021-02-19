import { pageFactory } from '../support';

export const Variables = pageFactory({
  url: '',
  selectors: {
    addVariableCTA: 'Call to action button Add variable',
    newButton: 'Variable editor New variable button',
    table: 'Variable editor Table',
    tableRowNameFields: (variableName: string) => `Variable editor Table Name field ${variableName}`,
    tableRowDefinitionFields: (variableName: string) => `Variable editor Table Definition field ${variableName}`,
    tableRowArrowUpButtons: (variableName: string) => `Variable editor Table ArrowUp button ${variableName}`,
    tableRowArrowDownButtons: (variableName: string) => `Variable editor Table ArrowDown button ${variableName}`,
    tableRowDuplicateButtons: (variableName: string) => `Variable editor Table Duplicate button ${variableName}`,
    tableRowRemoveButtons: (variableName: string) => `Variable editor Table Remove button ${variableName}`,
  },
});

export const VariablesSubMenu = pageFactory({
  url: '',
  selectors: {
    submenuItem: 'Dashboard template variables submenu item',
    submenuItemLabels: (item: string) => `Dashboard template variables submenu Label ${item}`,
    submenuItemValueDropDownValueLinkTexts: (item: string) =>
      `Dashboard template variables Variable Value DropDown value link text ${item}`,
    submenuItemValueDropDownDropDown: 'Dashboard template variables Variable Value DropDown DropDown',
    submenuItemValueDropDownOptionTexts: (item: string) =>
      `Dashboard template variables Variable Value DropDown option text ${item}`,
  },
});

export const VariableGeneral = pageFactory({
  url: '',
  selectors: {
    headerLink: 'Variable editor Header link',
    modeLabelNew: 'Variable editor Header mode New',
    modeLabelEdit: 'Variable editor Header mode Edit',
    generalNameInput: 'Variable editor Form Name field',
    generalTypeSelect: 'Variable editor Form Type select',
    generalLabelInput: 'Variable editor Form Label field',
    generalHideSelect: 'Variable editor Form Hide select',
    selectionOptionsMultiSwitch: 'Variable editor Form Multi switch',
    selectionOptionsIncludeAllSwitch: 'Variable editor Form IncludeAll switch',
    selectionOptionsCustomAllInput: 'Variable editor Form IncludeAll field',
    previewOfValuesOption: 'Variable editor Preview of Values option',
    addButton: 'Variable editor Add button',
    updateButton: 'Variable editor Update button',
  },
});

export const QueryVariable = pageFactory({
  url: '',
  selectors: {
    queryOptionsDataSourceSelect: 'Variable editor Form Query DataSource select',
    queryOptionsRefreshSelect: 'Variable editor Form Query Refresh select',
    queryOptionsRegExInput: 'Variable editor Form Query RegEx field',
    queryOptionsSortSelect: 'Variable editor Form Query Sort select',
    queryOptionsQueryInput: 'Variable editor Form Default Variable Query Editor textarea',
    valueGroupsTagsEnabledSwitch: 'Variable editor Form Query UseTags switch',
    valueGroupsTagsTagsQueryInput: 'Variable editor Form Query TagsQuery field',
    valueGroupsTagsTagsValuesQueryInput: 'Variable editor Form Query TagsValuesQuery field',
  },
});

export const ConstantVariable = pageFactory({
  url: '',
  selectors: {
    constantOptionsQueryInput: 'Variable editor Form Constant Query field',
  },
});
