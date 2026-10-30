import Handlebars from 'handlebars';

import { type Options, RenderMode, TextMode } from './panelcfg.gen';

const DATA_MACRO_PATTERN = /(?:\$\{?|\[\[)__(?:value|field|data|series)\b/;
const DATA_VARIABLE_PATTERN = /^__(?:value|field|data|series)\b/;
const STATIC_HELPERS = new Set([
  'and',
  'or',
  'not',
  'eq',
  'unlessEq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'startsWith',
  'endsWith',
  'match',
  'split',
  'join',
  'toFixed',
  'json',
  'date',
  'variable',
  'variableValue',
  'if',
  'unless',
  'each',
  'with',
  'lookup',
  'log',
]);

type Nodes = {
  PathExpression: hbs.AST.PathExpression;
  SubExpression: hbs.AST.SubExpression;
  StringLiteral: hbs.AST.StringLiteral;
  MustacheStatement: hbs.AST.MustacheStatement;
  BlockStatement: hbs.AST.BlockStatement;
};

function isNode<K extends keyof Nodes>(node: hbs.AST.Node, type: K): node is Nodes[K] {
  return node.type === type;
}

/** Shared by usage reporting and the migration that protects data-dependent Text content. */
export function getTextDataUsage(options: Partial<Options>) {
  const content = options.content ?? '';
  return {
    dataMacros: DATA_MACRO_PATTERN.test(content),
    perRow: options.renderMode === RenderMode.PerRow,
    dataBoundHandlebars: options.mode === TextMode.Code ? false : usesHandlebarsData(content),
  };
}

/** Undefined means analysis failed; migration must preserve queries in that case. */
function usesHandlebarsData(content: string): boolean | undefined {
  if (!content.includes('{{')) {
    return false;
  }

  // Each scope records whether its context can contain query data. Root is {data, frames}.
  function expression(node: hbs.AST.Expression, scopes: boolean[], aliases: Set<string>): boolean {
    if (isNode(node, 'PathExpression')) {
      const path = node;
      if (path.data && path.parts[0] === 'root') {
        return true;
      }
      if (!path.depth && aliases.has(path.parts[0])) {
        return false;
      }
      return scopes[path.depth] ?? true;
    }
    if (isNode(node, 'SubExpression')) {
      return invocation(node, scopes, aliases);
    }
    return false;
  }

  function invocation(
    node: hbs.AST.MustacheStatement | hbs.AST.BlockStatement | hbs.AST.SubExpression,
    scopes: boolean[],
    aliases: Set<string>
  ): boolean {
    if (!isNode(node.path, 'PathExpression')) {
      return true;
    }
    const name = node.path.original;
    if (!STATIC_HELPERS.has(name)) {
      return expression(node.path, scopes, aliases);
    }
    if (name === 'variable' || name === 'variableValue') {
      const arg = node.params[0];
      // A computed variable name could resolve to a data macro.
      return !arg || !isNode(arg, 'StringLiteral') || DATA_VARIABLE_PATTERN.test(arg.value);
    }
    return (
      node.params.some((param) => expression(param, scopes, aliases)) ||
      (node.hash?.pairs.some((pair) => expression(pair.value, scopes, aliases)) ?? false)
    );
  }

  function program(body: hbs.AST.Program, scopes: boolean[], aliases: Set<string>): boolean {
    return body.body.some((statement) => {
      if (statement.type === 'ContentStatement' || statement.type === 'CommentStatement') {
        return false;
      }
      if (isNode(statement, 'MustacheStatement')) {
        return invocation(statement, scopes, aliases);
      }
      if (isNode(statement, 'BlockStatement')) {
        const block = statement;
        if (invocation(block, scopes, aliases)) {
          return true;
        }
        const name = isNode(block.path, 'PathExpression') ? block.path.original : '';
        const changesContext = name === 'each' || name === 'with';
        const childAliases = new Set(aliases);
        for (const alias of block.program?.blockParams ?? []) {
          childAliases.add(alias);
        }
        return (
          (block.program
            ? program(block.program, changesContext ? [false, ...scopes] : scopes, childAliases)
            : false) || (block.inverse ? program(block.inverse, scopes, aliases) : false)
        );
      }
      // Partials and decorators can hide data access. Do not discard their queries.
      return true;
    });
  }

  try {
    return program(Handlebars.parse(content), [true], new Set());
  } catch {
    return undefined;
  }
}
