import { DeleteDashboardConfig } from './deleteDashboard';
import { e2e } from '../index';
import { getDashboardUid } from '../support/url';
import { setDashboardTimeRange, TimeRangeConfig } from './setDashboardTimeRange';
import { v4 as uuidv4 } from 'uuid';
import { selectOption } from './selectOption';

export interface AddAnnotationConfig {
  dataSource: string;
  dataSourceForm?: () => void;
  name: string;
}

export interface AddDashboardConfig {
  annotations: AddAnnotationConfig[];
  timeRange: TimeRangeConfig;
  title: string;
  variables: PartialAddVariableConfig[];
}

interface AddVariableDefault {
  hide: string;
  type: string;
}

interface AddVariableOptional {
  constantValue?: string;
  dataSource?: string;
  label?: string;
  query?: string;
  regex?: string;
}

interface AddVariableRequired {
  name: string;
}

export type PartialAddVariableConfig = Partial<AddVariableDefault> & AddVariableOptional & AddVariableRequired;
export type AddVariableConfig = AddVariableDefault & AddVariableOptional & AddVariableRequired;

export const addDashboard = (config?: Partial<AddDashboardConfig>) => {
  const fullConfig: AddDashboardConfig = {
    annotations: [],
    title: `e2e-${uuidv4()}`,
    variables: [],
    ...config,
    timeRange: {
      from: '2020-01-01 00:00:00',
      to: '2020-01-01 06:00:00',
      zone: 'Coordinated Universal Time',
      ...config?.timeRange,
    },
  };

  const { annotations, timeRange, title, variables } = fullConfig;

  e2e().logToConsole('Adding dashboard with title:', title);

  e2e.pages.AddDashboard.visit();

  if (annotations.length > 0 || variables.length > 0) {
    e2e.components.PageToolbar.item('Dashboard settings').click();
    addAnnotations(annotations);

    fullConfig.variables = addVariables(variables);

    e2e.components.BackButton.backArrow().should('be.visible').click({ force: true });
  }

  setDashboardTimeRange(timeRange);

  e2e.components.PageToolbar.item('Save dashboard').click();
  e2e.pages.SaveDashboardAsModal.newName().clear().type(title);
  e2e.pages.SaveDashboardAsModal.save().click();
  e2e.flows.assertSuccessNotification();

  e2e().logToConsole('Added dashboard with title:', title);

  return e2e()
    .url()
    .should('contain', '/d/')
    .then((url: string) => {
      const uid = getDashboardUid(url);

      e2e.getScenarioContext().then(({ addedDashboards }: any) => {
        e2e.setScenarioContext({
          addedDashboards: [...addedDashboards, { title, uid } as DeleteDashboardConfig],
        });
      });

      // @todo remove `wrap` when possible
      return e2e().wrap(
        {
          config: fullConfig,
          uid,
        },
        { log: false }
      );
    });
};

const addAnnotation = (config: AddAnnotationConfig, isFirst: boolean) => {
  if (isFirst) {
    e2e.pages.Dashboard.Settings.Annotations.List.addAnnotationCTA().click();
  } else {
    cy.contains('New query').click();
  }

  const { dataSource, dataSourceForm, name } = config;

  selectOption({
    container: e2e.components.DataSourcePicker.container(),
    optionText: dataSource,
  });

  e2e.pages.Dashboard.Settings.Annotations.Settings.name().clear().type(name);

  if (dataSourceForm) {
    dataSourceForm();
  }
};

const addAnnotations = (configs: AddAnnotationConfig[]) => {
  if (configs.length > 0) {
    e2e.pages.Dashboard.Settings.General.sectionItems('Annotations').click();
  }

  return configs.forEach((config, i) => addAnnotation(config, i === 0));
};

export const VARIABLE_HIDE_LABEL = 'Label';
export const VARIABLE_HIDE_NOTHING = '';
export const VARIABLE_HIDE_VARIABLE = 'Variable';

export const VARIABLE_TYPE_AD_HOC_FILTERS = 'Ad hoc filters';
export const VARIABLE_TYPE_CONSTANT = 'Constant';
export const VARIABLE_TYPE_DATASOURCE = 'Datasource';
export const VARIABLE_TYPE_QUERY = 'Query';

const addVariable = (config: PartialAddVariableConfig, isFirst: boolean): AddVariableConfig => {
  const fullConfig = {
    hide: VARIABLE_HIDE_NOTHING,
    type: VARIABLE_TYPE_QUERY,
    ...config,
  };

  if (isFirst) {
    e2e.pages.Dashboard.Settings.Variables.List.addVariableCTA().click();
  } else {
    e2e.pages.Dashboard.Settings.Variables.List.newButton().click();
  }

  const { constantValue, dataSource, label, name, query, regex, type } = fullConfig;

  // This field is key to many reactive changes
  if (type !== VARIABLE_TYPE_QUERY) {
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelect()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.singleValue().should('have.text', 'Query').click();
      });
    e2e.components.Select.option().should('be.visible').contains(type).click();
  }

  if (label) {
    e2e.pages.Dashboard.Settings.Variables.Edit.General.generalLabelInput().type(label);
  }

  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInput().clear().type(name);

  if (
    dataSource &&
    (type === VARIABLE_TYPE_AD_HOC_FILTERS || type === VARIABLE_TYPE_DATASOURCE || type === VARIABLE_TYPE_QUERY)
  ) {
    e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input().should('be.visible').type(`${dataSource}{enter}`);
      });
  }

  if (constantValue && type === VARIABLE_TYPE_CONSTANT) {
    e2e.pages.Dashboard.Settings.Variables.Edit.ConstantVariable.constantOptionsQueryInput().type(constantValue);
  }

  if (type === VARIABLE_TYPE_QUERY) {
    if (query) {
      e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsQueryInput().type(query);
    }

    if (regex) {
      e2e.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInput().type(regex);
    }
  }

  // Avoid flakiness
  e2e().focused().blur();

  e2e.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption()
    .should('exist')
    .within((previewOfValues) => {
      if (type === VARIABLE_TYPE_CONSTANT) {
        expect(previewOfValues.text()).equals(constantValue);
      }
    });

  e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().click();

  return fullConfig;
};

const addVariables = (configs: PartialAddVariableConfig[]): AddVariableConfig[] => {
  if (configs.length > 0) {
    e2e.pages.Dashboard.Settings.General.sectionItems('Variables').click();
  }

  return configs.map((config, i) => addVariable(config, i === 0));
};
