import { CollectorData, CollectorItem, CollectorWorkers, Sanitizer } from '../types';
import {
  AdHocVariableFilter,
  AdHocVariableModel,
  ConstantVariableModel,
  CustomVariableModel,
  DataSourceVariableModel,
  IntervalVariableModel,
  QueryVariableModel,
  TextBoxVariableModel,
  VariableModel,
  VariableOption,
  VariableTag,
  VariableWithOptions,
} from 'app/features/variables/types';
import {
  isAdHoc,
  isConstant,
  isCustom,
  isDataSource,
  isInterval,
  isQuery,
  isTextBox,
} from '../../../../variables/guard';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../../../../variables/state/types';

const REPLACE_WITH = '******';

export class VariablesSanitizer implements Sanitizer {
  id: 'VariablesSanitizer';

  constructor() {}

  canSanitize(item: CollectorItem): boolean {
    if (item.id !== CollectorWorkers.dashboard) {
      return false;
    }

    const variables = VariablesSanitizer.getVariables(item);
    const templatingListExists = Boolean(variables);
    const isArray = Array.isArray(variables);
    const hasVariables = variables ? Boolean(variables.length) : false;

    if (templatingListExists && isArray && hasVariables) {
      return true;
    }

    return false;
  }

  sanitize(item: CollectorItem): CollectorData {
    if (!this.canSanitize(item)) {
      return { ...item, data: { error: 'Calling sanitize on a sanitizer that can not sanitize' } };
    }

    const variables = VariablesSanitizer.getVariables(item);
    const sanitizers: VariableTypeSanitizer[] = [
      new ConstantSanitizer(),
      new TextBoxSanitizer(),
      new CustomSanitizer(),
      new IntervalSanitizer(),
      new DataSourceSanitizer(),
      new QuerySanitizer(),
      new AdHocSanitizer(),
    ];

    const newVariables: VariableModel[] = [];
    for (const variable of variables!) {
      const sanitizer = sanitizers.find((s) => s.canSanitize(variable));
      if (!sanitizer) {
        newVariables.push(variable);
        continue;
      }

      newVariables.push(sanitizer.sanitize(variable));
    }

    return { ...item.data, templating: { list: newVariables } };
  }

  private static getVariables(item: CollectorItem): undefined | VariableModel[] {
    return item.data.templating?.list;
  }
}

interface VariableTypeSanitizer<T extends VariableModel = VariableModel> {
  canSanitize: (variable: VariableModel) => boolean;
  sanitize: (variable: T) => T;
}

function getSanitizedValue(value: any): string {
  if (value === ALL_VARIABLE_TEXT || value === ALL_VARIABLE_VALUE) {
    return value;
  }
  return REPLACE_WITH;
}

function sanitizeStringOrStringArray(value?: any | any[]): any | any[] {
  if (Array.isArray(value)) {
    return value.map((v, index) => getSanitizedValue(v));
  }

  return getSanitizedValue(value);
}

function sanitizeOption(option: VariableOption): VariableOption {
  return {
    ...option,
    text: sanitizeStringOrStringArray(option.text),
    value: sanitizeStringOrStringArray(option.value),
    tags: sanitizeTags(option.tags),
  };
}

function sanitizeFilter(filter: AdHocVariableFilter): AdHocVariableFilter {
  return {
    ...filter,
    key: sanitizeStringOrStringArray(filter.key),
    value: sanitizeStringOrStringArray(filter.key),
  };
}

function sanitizeTags(tags?: VariableTag[]): VariableTag[] {
  if (!tags) {
    return [];
  }

  return tags.map((t) => ({
    ...t,
    text: sanitizeStringOrStringArray(t.text),
    values: sanitizeStringOrStringArray(t.values),
    valuesText: sanitizeStringOrStringArray(t.valuesText),
  }));
}

function sanitizeVariable(variable: VariableModel): VariableModel {
  const id = getSanitizedValue(variable.id);

  return {
    ...variable,
    id,
    description: REPLACE_WITH,
    label: REPLACE_WITH,
    name: id,
  };
}

function sanitizeVariableWithOptions<T extends VariableWithOptions = VariableWithOptions>(variable: T): T {
  const base = (sanitizeVariable(variable) as unknown) as T;
  return {
    ...base,
    query: getSanitizedValue(variable.query),
    current: sanitizeOption(variable.current),
    options: variable.options.map((o) => sanitizeOption(o)),
  };
}

class ConstantSanitizer implements VariableTypeSanitizer<ConstantVariableModel> {
  canSanitize(variable: VariableModel): boolean {
    return Boolean(variable) && isConstant(variable);
  }

  sanitize(variable: ConstantVariableModel): ConstantVariableModel {
    if (!this.canSanitize(variable)) {
      return variable;
    }

    return sanitizeVariableWithOptions(variable);
  }
}

class TextBoxSanitizer implements VariableTypeSanitizer<TextBoxVariableModel> {
  canSanitize(variable: VariableModel): boolean {
    return Boolean(variable) && isTextBox(variable);
  }

  sanitize(variable: TextBoxVariableModel): TextBoxVariableModel {
    if (!this.canSanitize(variable)) {
      return variable;
    }

    return {
      ...sanitizeVariableWithOptions(variable),
      originalQuery: sanitizeStringOrStringArray(variable.originalQuery),
    };
  }
}

class CustomSanitizer implements VariableTypeSanitizer<CustomVariableModel> {
  canSanitize(variable: VariableModel): boolean {
    return Boolean(variable) && isCustom(variable);
  }

  sanitize(variable: CustomVariableModel): CustomVariableModel {
    if (!this.canSanitize(variable)) {
      return variable;
    }

    return {
      ...sanitizeVariableWithOptions(variable),
      allValue: REPLACE_WITH,
    };
  }
}

class IntervalSanitizer implements VariableTypeSanitizer<IntervalVariableModel> {
  canSanitize(variable: VariableModel): boolean {
    return Boolean(variable) && isInterval(variable);
  }

  sanitize(variable: IntervalVariableModel): IntervalVariableModel {
    if (!this.canSanitize(variable)) {
      return variable;
    }

    return sanitizeVariableWithOptions(variable);
  }
}

class DataSourceSanitizer implements VariableTypeSanitizer<DataSourceVariableModel> {
  canSanitize(variable: VariableModel): boolean {
    return Boolean(variable) && isDataSource(variable);
  }

  sanitize(variable: DataSourceVariableModel): DataSourceVariableModel {
    if (!this.canSanitize(variable)) {
      return variable;
    }

    return {
      ...sanitizeVariableWithOptions(variable),
      regex: REPLACE_WITH,
    };
  }
}

class QuerySanitizer implements VariableTypeSanitizer<QueryVariableModel> {
  canSanitize(variable: VariableModel): boolean {
    return Boolean(variable) && isQuery(variable);
  }

  sanitize(variable: QueryVariableModel): QueryVariableModel {
    if (!this.canSanitize(variable)) {
      return variable;
    }

    return {
      ...sanitizeVariableWithOptions(variable),
      regex: REPLACE_WITH,
      allValue: REPLACE_WITH,
      datasource: REPLACE_WITH,
      definition: REPLACE_WITH,
      queryValue: REPLACE_WITH,
      tagsQuery: REPLACE_WITH,
      tagValuesQuery: REPLACE_WITH,
      tags: sanitizeTags(variable.tags),
    };
  }
}

class AdHocSanitizer implements VariableTypeSanitizer<AdHocVariableModel> {
  canSanitize(variable: VariableModel): boolean {
    return Boolean(variable) && isAdHoc(variable);
  }

  sanitize(variable: AdHocVariableModel): AdHocVariableModel {
    if (!this.canSanitize(variable)) {
      return variable;
    }

    const base = sanitizeVariable(variable);
    return {
      ...base,
      datasource: REPLACE_WITH,
      filters: variable.filters.map((f) => sanitizeFilter(f)),
    };
  }
}
