import { SyntaxNode, TreeCursor } from '@lezer/common';

// This is used for error type for some reason
export const ErrorName = '⚠';

export function getLeftMostChild(cur: SyntaxNode): SyntaxNode | null {
  let child = cur;
  while (true) {
    if (child.firstChild) {
      child = child.firstChild;
    } else {
      break;
    }
  }
  return child;
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
 * As variables with $ are creating parsing errors, we first replace them with magic string that is parseable and at
 * the same time we can get the variable and it's format back from it.
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
 * Get beck the text with variables in their original format.
 * @param expr
 */
function returnVariables(expr: string) {
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
) {
  const params: any[] = [parseFloat(getString(expr, numberNode))];
  if (opDef.comparison) {
    params.unshift(hasBool);
  }
  return {
    id: opDef.id,
    params,
  };
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

function jsonToText(
  node: Record<string, any>,
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
  children.forEach((child: any, index: number) => {
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
