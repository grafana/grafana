import { SyntaxNode, TreeCursor } from '@lezer/common';

import { QueryBuilderOperation, QueryBuilderOperationParamValue } from './types';

// Although 0 isn't explicitly provided in the lezer-promql & @grafana/lezer-logql library as the error node ID, it does appear to be the ID of error nodes within lezer.
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
 * As variables with $ are creating parsing errors, we first replace them with magic string that is parsable and at
 * the same time we can get the variable and its format back from it.
 * @param expr
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
 * @param type - can be string or number, some data-sources (loki) haven't migrated over to using numeric constants defined in the lezer parsing library (e.g. lezer-promql).
 * @todo Remove string type definition when all data-sources have migrated to numeric constants
 */
export function getAllByType(expr: string, cur: SyntaxNode, type: number | string): string[] {
  if (cur.type.id === type || cur.name === type) {
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

// Debugging function for convenience. Gives you nice output similar to linux tree util.
// @ts-ignore
export function log(expr: string, cur?: SyntaxNode) {
  if (!cur) {
    console.log('<empty>');
    return;
  }
  const json = toJson(expr, cur);
  const text = jsonToText(json);

  if (!text) {
    console.log('<empty>');
    return;
  }
  console.log(text);
}

function toJson(expr: string, cur: SyntaxNode) {
  const treeJson: any = {};
  const name = nodeToString(expr, cur);
  const children = [];

  let pos = 0;
  let child = cur.childAfter(pos);
  while (child) {
    children.push(toJson(expr, child));
    pos = child.to;
    child = cur.childAfter(pos);
  }

  treeJson.name = name;
  treeJson.children = children;
  return treeJson;
}

type JsonNode = {
  name: string;
  children: JsonNode[];
};

function jsonToText(
  node: JsonNode,
  context: { lastChild: boolean; indent: string } = {
    lastChild: true,
    indent: '',
  }
) {
  const name = node.name;
  const { lastChild, indent } = context;
  const newIndent = indent !== '' ? indent + (lastChild ? '└─' : '├─') : '';
  let text = newIndent + name;

  const children = node.children;
  children.forEach((child, index) => {
    const isLastChild = index === children.length - 1;
    text +=
      '\n' +
      jsonToText(child, {
        lastChild: isLastChild,
        indent: indent + (lastChild ? '  ' : '│ '),
      });
  });

  return text;
}

function nodeToString(expr: string, node: SyntaxNode) {
  return node.name + ': ' + getString(expr, node);
}

/**
 * There aren't any spaces in the metric names, so let's introduce a wildcard into the regex for each space to better facilitate a fuzzy search
 */
export const regexifyLabelValuesQueryString = (query: string) => {
  const queryArray = query.split(' ');
  return queryArray.map((query) => `${query}.*`).join('');
};
