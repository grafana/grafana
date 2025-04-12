// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/parsingUtils.ts
import { SyntaxNode, TreeCursor } from '@lezer/common';

import { QueryBuilderOperation, QueryBuilderOperationParamValue } from './shared/types';

// Although 0 isn't explicitly provided in the lezer-promql library as the error node ID, it does appear to be the ID of error nodes within lezer.
export const ErrorId = 0;

export function getLeftMostChild(cur: SyntaxNode): SyntaxNode {
  return cur.firstChild ? getLeftMostChild(cur.firstChild) : cur;
}

export function makeError(expr: string, node: SyntaxNode) {
  return {
    text: getString(expr, node),
    // TODO: this are positions in the string with the replaced variables. Means it cannot be used to show exact
    //  placement of the error for the user. We need some translation table to positions before the variable
    //  replace.
    from: node.from,
    to: node.to,
    parentType: node.parent?.name,
  };
}

// Taken from template_srv, but copied so to not mess with the regex.index which is manipulated in the service
/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * \$(\w+)                          $var1
 * \[\[([\s\S]+?)(?::(\w+))?\]\]    [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?::(\w+))?}             ${var3} or ${var3:fmt3}
 */
const variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;

/**
 * As variables with $ are creating parsing errors, we first replace them with magic string that is
 * parsable and at the same time we can get the variable and its format back from it.
 */
export function replaceVariables(expr: string) {
  return expr.replace(variableRegex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
    const fmt = fmt2 || fmt3;
    let variable = var1;
    let varType = '0';

    if (var2) {
      variable = var2;
      varType = '1';
    }

    if (var3) {
      variable = var3;
      varType = '2';
    }

    return `__V_${varType}__` + variable + '__V__' + (fmt ? '__F__' + fmt + '__F__' : '');
  });
}

const varTypeFunc = [
  (v: string, f?: string) => `\$${v}`,
  (v: string, f?: string) => `[[${v}${f ? `:${f}` : ''}]]`,
  (v: string, f?: string) => `\$\{${v}${f ? `:${f}` : ''}\}`,
];

/**
 * Get back the text with variables in their original format.
 * @param expr
 */
export function returnVariables(expr: string) {
  return expr.replace(/__V_(\d)__(.+?)__V__(?:__F__(\w+)__F__)?/g, (match, type, v, f) => {
    return varTypeFunc[parseInt(type, 10)](v, f);
  });
}

/**
 * Get the actual string of the expression. That is not stored in the tree so we have to get the indexes from the node
 * and then based on that get it from the expression.
 * @param expr
 * @param node
 */
export function getString(expr: string, node: SyntaxNode | TreeCursor | null | undefined) {
  if (!node) {
    return '';
  }
  return returnVariables(expr.substring(node.from, node.to));
}

/**
 * Create simple scalar binary op object.
 * @param opDef - definition of the op to be created
 * @param expr
 * @param numberNode - the node for the scalar
 * @param hasBool - whether operation has a bool modifier. Is used only for ops for which it makes sense.
 */
export function makeBinOp(
  opDef: { id: string; comparison?: boolean },
  expr: string,
  numberNode: SyntaxNode,
  hasBool: boolean
): QueryBuilderOperation {
  const params: QueryBuilderOperationParamValue[] = [parseFloat(getString(expr, numberNode))];
  if (opDef.comparison) {
    params.push(hasBool);
  }
  return {
    id: opDef.id,
    params,
  };
}

/**
 * Get all nodes with type in the tree. This traverses the tree so it is safe only when you know there shouldn't be
 * too much nesting but you just want to skip some of the wrappers. For example getting function args this way would
 * not be safe is it would also find arguments of nested functions.
 * @param expr
 * @param cur
 * @param type
 */
export function getAllByType(expr: string, cur: SyntaxNode, type: number): string[] {
  if (cur.type.id === type) {
    return [getString(expr, cur)];
  }
  const values: string[] = [];
  let pos = 0;
  let child = cur.childAfter(pos);
  while (child) {
    values.push(...getAllByType(expr, child, type));
    pos = child.to;
    child = cur.childAfter(pos);
  }
  return values;
}

/**
 * There aren't any spaces in the metric names, so let's introduce a wildcard into the regex for each space to better facilitate a fuzzy search
 */
export const regexifyLabelValuesQueryString = (query: string) => {
  const queryArray = query.split(' ');
  return queryArray.map((query) => `${query}.*`).join('');
};

/**
 * Built-in Grafana variables used for time ranges and intervals in Prometheus queries
 * Each variable has a carefully crafted numeric replacement that:
 * 1. Has exactly the same string length as the original variable
 * 2. Is valid in Prometheus syntax to avoid parsing errors
 * 3. Preserves error position information for accurate error reporting
 * 4. Uses readable number formatting with digit grouping via underscores
 * https://prometheus.io/docs/prometheus/latest/querying/basics/#float-literals-and-time-durations
 */
const BUILT_IN_VARIABLES = [
  { variable: '$__interval_ms', replacement: '79_999_999_999' },
  { variable: '$__interval', replacement: '711_999_999' },
  { variable: '$__rate_interval', replacement: '7999799979997999' },
  { variable: '$__range_ms', replacement: '722_999_999' },
  { variable: '$__range_s', replacement: '79_299_999' },
  { variable: '$__range', replacement: '799_999' },
];

// Derived maps for efficient lookups
const variableToReplacement = BUILT_IN_VARIABLES.reduce<Record<string, string>>((map, { variable, replacement }) => {
  map[variable] = replacement;
  return map;
}, {});

const replacementToVariable = BUILT_IN_VARIABLES.reduce<Record<string, string>>((map, { variable, replacement }) => {
  map[replacement] = variable;
  return map;
}, {});

// Pre-compiled regular expressions for efficient search/replace
const builtInVariablePattern = BUILT_IN_VARIABLES.map(({ variable }) => variable.replace(/\$/g, '\\$')).join('|');
const builtInVariableRegex = new RegExp(builtInVariablePattern, 'g');

const builtInReplacementPattern = BUILT_IN_VARIABLES.map(({ replacement }) => replacement).join('|');
const builtInReplacementRegex = new RegExp(builtInReplacementPattern, 'g');

/**
 * Replaces Grafana built-in variables with numeric replacements
 * This helps prevent these variables from causing parsing errors
 */
export function replaceBuiltInVariable(expr: string): string {
  return expr.replace(builtInVariableRegex, (match) => variableToReplacement[match]);
}

/**
 * Restores the original built-in variables from their replacement format
 * Reverses the transformation done by replaceBuiltInVariable
 */
export function returnBuiltInVariable(expr: string): string {
  return expr.replace(builtInReplacementRegex, (match) => replacementToVariable[match]);
}
