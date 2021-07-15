import { FuncDefs, FuncInstance, ParamDef } from '../gfunc';
import { forEach, sortBy } from 'lodash';
import { SelectableValue } from '@grafana/data';
import { EditableParam } from './FunctionParamEditor';

export function mapFuncDefsToSelectables(funcDefs: FuncDefs): Array<SelectableValue<string>> {
  const categories: any = {};

  forEach(funcDefs, (funcDef) => {
    if (!funcDef.category) {
      return;
    }
    if (!categories[funcDef.category]) {
      categories[funcDef.category] = { label: funcDef.category, value: funcDef.category, options: [] };
    }
    categories[funcDef.category].options.push({
      label: funcDef.name,
      value: funcDef.name,
    });
  });

  return sortBy(categories, 'label');
}

/**
 * Create a list of params that can be edited in the function editor:
 * - required params (defined in func.def) are always displayed even when the value is not specified
 */
export function mapFuncInstanceToParams(func: FuncInstance): EditableParam[] {
  let params: EditableParam[] = func.def.params.map((paramDef: ParamDef, index: number) => {
    const value = func.params[index];
    return {
      name: paramDef.name,
      value: value?.toString() || '',
      optional: !!paramDef.optional,
      options: paramDef.options?.map((option: string | number) => option.toString()) || [],
      multiple: !!paramDef.multiple,
    };
  });

  while (params.length < func.params.length) {
    const paramDef = func.def.params[func.def.params.length - 1];
    const value = func.params[params.length];

    params.push({
      name: paramDef.name,
      optional: !!paramDef.optional,
      multiple: !!paramDef.multiple,
      value: value?.toString() || '',
      options: paramDef.options?.map((option: string | number) => option.toString()) || [],
    });
  }

  if (params.length && params[params.length - 1].value && params[params.length - 1]?.multiple) {
    const paramDef = func.def.params[func.def.params.length - 1];
    params.push({
      name: paramDef.name,
      optional: !!paramDef.optional,
      multiple: !!paramDef.multiple,
      value: '',
      options: paramDef.options?.map((option: string | number) => option.toString()) || [],
    });
  }

  return params;
}
