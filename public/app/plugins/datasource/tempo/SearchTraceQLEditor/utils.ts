import { startCase, uniq } from 'lodash';

import { AdHocVariableFilter, ScopedVars, SelectableValue } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { VariableFormatID } from '@grafana/schema';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { getEscapedSpanNames } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { Scope } from '../types';

export const interpolateFilters = (filters: TraceqlFilter[], scopedVars?: ScopedVars) => {
  const interpolatedFilters = filters.map((filter) => {
    const updatedFilter = {
      ...filter,
      tag: getTemplateSrv().replace(filter.tag ?? '', scopedVars ?? {}),
    };

    if (filter.value) {
      updatedFilter.value =
        typeof filter.value === 'string'
          ? getTemplateSrv().replace(filter.value ?? '', scopedVars ?? {}, VariableFormatID.Pipe)
          : filter.value.map((v) => getTemplateSrv().replace(v ?? '', scopedVars ?? {}, VariableFormatID.Pipe));
    }

    return updatedFilter;
  });

  return interpolatedFilters;
};

const isRegExpOperator = (operator: string) => operator === '=~' || operator === '!~';

const escapeValues = (values: string[]) => getEscapedSpanNames(values);

export const valueHelper = (f: TraceqlFilter) => {
  const value = Array.isArray(f.value) && isRegExpOperator(f.operator!) ? escapeValues(f.value) : f.value;

  if (Array.isArray(value) && value.length > 1) {
    return `"${value.join('|')}"`;
  }
  if (f.valueType === 'string') {
    return `"${value}"`;
  }
  return value;
};

export const scopeHelper = (f: TraceqlFilter, lp: TempoLanguageProvider) => {
  // Intrinsic fields don't have a scope
  if (lp.getIntrinsics().find((t) => t === f.tag)) {
    return '';
  }
  return (
    (f.scope === TraceqlSearchScope.Event ||
    f.scope === TraceqlSearchScope.Instrumentation ||
    f.scope === TraceqlSearchScope.Link ||
    f.scope === TraceqlSearchScope.Resource ||
    f.scope === TraceqlSearchScope.Span
      ? f.scope?.toLowerCase()
      : '') + '.'
  );
};

export const tagHelper = (f: TraceqlFilter, filters: TraceqlFilter[]) => {
  if (f.tag === 'duration') {
    const durationType = filters.find((f) => f.id === 'duration-type');
    if (durationType) {
      return durationType.value === 'trace' ? 'traceDuration' : 'duration';
    }
    return f.tag;
  }
  return f.tag;
};

export const generateQueryFromAdHocFilters = (filters: AdHocVariableFilter[], lp: TempoLanguageProvider) => {
  return `{${filters
    .filter((f) => f.key && f.operator && f.value)
    .map((f) => `${f.key}${f.operator}${adHocValueHelper(f, lp)}`)
    .join(' && ')}}`;
};

const adHocValueHelper = (f: AdHocVariableFilter, lp: TempoLanguageProvider) => {
  if (lp.getIntrinsics().find((t) => t === f.key)) {
    return f.value;
  }
  if (parseInt(f.value, 10).toString() === f.value) {
    return f.value;
  }
  return `"${f.value}"`;
};

export const getTagWithoutScope = (tag: string) => {
  return tag.replace(/^(event|instrumentation|link|resource|span)\./, '');
};

export const filterScopedTag = (f: TraceqlFilter, lp: TempoLanguageProvider) => {
  return scopeHelper(f, lp) + f.tag;
};

export const filterTitle = (f: TraceqlFilter, lp: TempoLanguageProvider) => {
  // Special case for the intrinsic "name" since a label called "Name" isn't explicit
  if (f.tag === 'name') {
    return 'Span Name';
  }
  // Special case for the resource service name
  if (f.tag === 'service.name' && f.scope === TraceqlSearchScope.Resource) {
    return 'Service Name';
  }
  return startCase(filterScopedTag(f, lp));
};

export const getFilteredTags = (tags: string[], staticTags: Array<string | undefined>) => {
  return [...tags].filter((t) => !staticTags.includes(t));
};

export const getUnscopedTags = (scopes: Scope[]) => {
  return uniq(
    scopes
      .map((scope: Scope) =>
        scope.name && scope.name !== TraceqlSearchScope.Intrinsic && scope.tags ? scope.tags : []
      )
      .flat()
  );
};

export const getIntrinsicTags = (scopes: Scope[]) => {
  return uniq(
    scopes
      .map((scope: Scope) =>
        scope.name && scope.name === TraceqlSearchScope.Intrinsic && scope.tags ? scope.tags : []
      )
      .flat()
  );
};

export const getAllTags = (scopes: Scope[]) => {
  return uniq(scopes.map((scope: Scope) => (scope.tags ? scope.tags : [])).flat());
};

export const getTagsByScope = (scopes: Scope[], scope: TraceqlSearchScope | string) => {
  return uniq(scopes.map((s: Scope) => (s.name && s.name === scope && s.tags ? s.tags : [])).flat());
};

export function replaceAt<T>(array: T[], index: number, value: T) {
  const ret = array.slice(0);
  ret[index] = value;
  return ret;
}

export const operatorSelectableValue = (op: string) => {
  const result: SelectableValue = { label: op, value: op };
  switch (op) {
    case '=':
      result.description = 'Equals';
      break;
    case '!=':
      result.description = 'Not equals';
      break;
    case '>':
      result.description = 'Greater';
      break;
    case '>=':
      result.description = 'Greater or Equal';
      break;
    case '<':
      result.description = 'Less';
      break;
    case '<=':
      result.description = 'Less or Equal';
      break;
    case '=~':
      result.description = 'Matches regex';
      break;
    case '!~':
      result.description = 'Does not match regex';
      break;
  }
  return result;
};
