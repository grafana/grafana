import { forEach, sortBy } from 'lodash';

import { SelectableValue } from '@grafana/data';

import { FuncDefs, FuncInstance, ParamDef } from '../gfunc';
import { GraphiteQuery, GraphiteQueryType, GraphiteSegment } from '../types';

import { EditableParam } from './FunctionParamEditor';
import { VARIABLE_DELIMITER } from './GraphiteVariableEditor';

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

export function convertVariableStringToGraphiteQueryObject(query: string | GraphiteQuery): GraphiteQuery {
  if (typeof query === 'string') {
    const queryParts = query.split(VARIABLE_DELIMITER);
    if (queryParts.length === 1) {
      return {
        refId: 'A',
        target: query,
        queryType: GraphiteQueryType.Default.toString(),
      };
    } else {
      return {
        refId: 'A',
        queryType: queryParts[0],
        target: queryParts[1],
      };
    }
  }
  return query;
}

/**  Migrate the query back to a string so that Variable Definitions work */
export function convertToVariableString(query: string | GraphiteQuery): string {
  // if it is an old query or a new new hot fix query
  if (typeof query === 'string') {
    const queryParts = query.split(VARIABLE_DELIMITER);

    if (queryParts.length === 1) {
      // old query
      // concat default queryType to it
      return concatParts(GraphiteQueryType.Default, query);
    } else {
      // the new new hotfix query
      return query;
    }
  }
  // it is an object so we can
  // concatenate the queryType and query
  return concatParts(query.queryType, query.target);
}

/**  The query string consists of a query type of idx 0 and target of idx 1 */
export function getQueryPart(query: string, idx: number): string {
  return query.split(VARIABLE_DELIMITER)[idx];
}

/**  Concat the query parts type and target with the delimiter */
export function concatParts(queryType: string | undefined, target: string | undefined): string {
  return `${queryType}${VARIABLE_DELIMITER}${target}`;
}
