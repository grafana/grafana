import { forEach, sortBy } from 'lodash';

import { SelectableValue } from '@grafana/data';

import { FuncDefs, FuncInstance, ParamDef } from '../gfunc';
import { GraphiteQuery, GraphiteQueryType, GraphiteSegment } from '../types';

import { EditableParam } from './FunctionParamEditor';

export function mapStringsToSelectables<T extends string>(values: T[]): Array<SelectableValue<T>> {
  return values.map((value) => ({
    value,
    label: value,
  }));
}

export function mapSegmentsToSelectables(segments: GraphiteSegment[]): Array<SelectableValue<GraphiteSegment>> {
  return segments.map((segment) => ({
    label: segment.value,
    value: segment,
  }));
}

export function mapFuncDefsToSelectables(funcDefs: FuncDefs): Array<SelectableValue<string>> {
  const categories: Record<string, SelectableValue<string>> = {};

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

function createEditableParam(paramDef: ParamDef, additional: boolean, value?: string | number): EditableParam {
  return {
    name: paramDef.name,
    value: value?.toString() || '',
    optional: !!paramDef.optional || additional, // only first param is required when multiple are allowed
    multiple: !!paramDef.multiple,
    options:
      paramDef.options?.map((option: string | number) => ({
        value: option.toString(),
        label: option.toString(),
      })) ?? [],
  };
}

/**
 * Create a list of params that can be edited in the function editor.
 */
export function mapFuncInstanceToParams(func: FuncInstance): EditableParam[] {
  // list of required parameters (from func.def)
  const params: EditableParam[] = func.def.params.map((paramDef: ParamDef, index: number) =>
    createEditableParam(paramDef, false, func.params[index])
  );

  // list of additional (multiple or optional) params entered by the user
  while (params.length < func.params.length) {
    const paramDef = func.def.params[func.def.params.length - 1];
    const value = func.params[params.length];
    params.push(createEditableParam(paramDef, true, value));
  }

  // extra "fake" param to allow adding more multiple values at the end
  if (params.length && params[params.length - 1].value && params[params.length - 1]?.multiple) {
    const paramDef = func.def.params[func.def.params.length - 1];
    params.push(createEditableParam(paramDef, true, ''));
  }

  return params;
}

export function convertToGraphiteQueryObject(query: string | GraphiteQuery): GraphiteQuery {
  if (typeof query === 'string') {
    return {
      refId: 'A',
      target: query,
      queryType: GraphiteQueryType.Default.toString(),
    };
  }
  return query;
}
