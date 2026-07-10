import { type SyntaxNode, type Tree } from '@lezer/common';
import {
  AggregateModifier,
  By,
  GroupingLabels,
  LabelName,
  MatchOp,
  parser,
  QuotedLabelMatcher,
  QuotedLabelName,
  StringLiteral,
  UnquotedLabelMatcher,
} from '@prometheus-io/lezer-promql';

// The machinery below (variableRegex, replaceVariables, built-in variable replacement) is
// adapted from @grafana/prometheus src/querybuilder/parsingUtils.ts, which is not exported
// from the package. Grafana variables are not valid PromQL, so before parsing they are
// swapped for grammar-safe placeholder identifiers that encode the variable name.

/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * \$(\w+)                          $var1
 * \[\[([\s\S]+?)(?::(\w+))?\]\]    [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?::(\w+))?}             ${var3} or ${var3:fmt3}
 */
const variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;

function replaceVariables(expr: string): string {
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

// Built-in interval/range variables sit in duration positions where the placeholder
// identifiers above would be parse errors, so they get numeric replacements instead
// (same trick and values as @grafana/prometheus; $__auto added since scenes uses it).
const BUILT_IN_VARIABLES: Array<{ variable: string; replacement: string }> = [
  { variable: '$__interval_ms', replacement: '79_999_999_999' },
  { variable: '$__interval', replacement: '711_999_999' },
  { variable: '$__rate_interval', replacement: '7999799979997999' },
  { variable: '$__range_ms', replacement: '722_999_999' },
  { variable: '$__range_s', replacement: '79_299_999' },
  { variable: '$__range', replacement: '799_999' },
  { variable: '$__auto', replacement: '7_99_999' },
];

const builtInVariableRegex = new RegExp(
  BUILT_IN_VARIABLES.map(({ variable }) => variable.replace(/\$/g, '\\$')).join('|'),
  'g'
);

function replaceBuiltInVariables(expr: string): string {
  return expr.replace(builtInVariableRegex, (match) => {
    return BUILT_IN_VARIABLES.find((v) => v.variable === match)?.replacement ?? match;
  });
}

const placeholderPattern = /__V_[0-2]__(\w+?)__V__(?:__F__.+?__F__)?/;

/**
 * Returns true when the text contains a reference to the given variable in any of the
 * three interpolation syntaxes ($var, [[var]], ${var}, with optional format/field path).
 */
export function textReferencesVariable(text: string, variableName: string): boolean {
  for (const match of text.matchAll(variableRegex)) {
    const name = match[1] ?? match[2] ?? match[4];
    if (name === variableName) {
      return true;
    }
  }
  return false;
}

export type PromQLVariableUsage =
  | { position: 'filterValue'; labelKey: string; operator: string }
  | { position: 'groupByLabel' }
  | { position: 'other'; context: string };

export interface ExprVariableUsages {
  /** One entry per occurrence of the variable in the expression, in source order. */
  usages: PromQLVariableUsage[];
  hasParseError: boolean;
}

/**
 * Classifies every occurrence of a variable in a PromQL expression by its structural
 * position (lezer parse, no regex guessing):
 * - `filterValue`: the variable is the entire value of a label matcher (`{key=~"$var"}`)
 * - `groupByLabel`: the variable is a grouping label in a `by(...)` aggregation modifier
 * - `other`: anything else (metric name, function arg, `without(...)`, partial matcher
 *   value, negative matcher, on/ignoring, ...) — callers should treat these as unsafe.
 */
export function classifyVariableUsagesInExpr(expr: string, variableName: string): ExprVariableUsages {
  const replacedExpr = replaceVariables(replaceBuiltInVariables(expr));
  const tree = parser.parse(replacedExpr);

  const usages: PromQLVariableUsage[] = [];
  const occurrenceRegex = new RegExp(`__V_[0-2]__${variableName}__V__(?:__F__.+?__F__)?`, 'g');

  for (const match of replacedExpr.matchAll(occurrenceRegex)) {
    usages.push(classifyOccurrence(tree, replacedExpr, match.index, match.index + match[0].length));
  }

  return { usages, hasParseError: treeHasError(tree) };
}

function classifyOccurrence(tree: Tree, expr: string, from: number, to: number): PromQLVariableUsage {
  const node = tree.resolveInner(from, 1);

  if (node.type.id === StringLiteral) {
    return classifyStringLiteralOccurrence(node, expr, from, to);
  }

  if (node.type.id === LabelName && node.parent?.type.id === GroupingLabels) {
    return classifyGroupingLabelOccurrence(node, from, to);
  }

  return { position: 'other', context: nodeContext(node) };
}

function classifyStringLiteralOccurrence(
  stringNode: SyntaxNode,
  expr: string,
  from: number,
  to: number
): PromQLVariableUsage {
  const matcher = stringNode.parent;
  if (!matcher || (matcher.type.id !== UnquotedLabelMatcher && matcher.type.id !== QuotedLabelMatcher)) {
    return { position: 'other', context: nodeContext(stringNode) };
  }

  // The variable must be the entire matcher value (only the quotes around it).
  if (from !== stringNode.from + 1 || to !== stringNode.to - 1) {
    return { position: 'other', context: 'partial label matcher value' };
  }

  const labelKey = getMatcherLabelKey(matcher, expr);
  if (labelKey === undefined || placeholderPattern.test(labelKey)) {
    return { position: 'other', context: 'variable label matcher key' };
  }

  const opNode = matcher.getChild(MatchOp);
  const operator = opNode ? expr.substring(opNode.from, opNode.to) : undefined;
  if (operator !== '=' && operator !== '=~') {
    return { position: 'other', context: `unsupported matcher operator "${operator}"` };
  }

  return { position: 'filterValue', labelKey, operator };
}

function getMatcherLabelKey(matcher: SyntaxNode, expr: string): string | undefined {
  const labelNode = matcher.getChild(LabelName) ?? matcher.getChild(QuotedLabelName);
  if (!labelNode) {
    return undefined;
  }

  const text = expr.substring(labelNode.from, labelNode.to);
  return labelNode.type.id === QuotedLabelName ? text.slice(1, -1) : text;
}

function classifyGroupingLabelOccurrence(labelNode: SyntaxNode, from: number, to: number): PromQLVariableUsage {
  if (labelNode.from !== from || labelNode.to !== to) {
    return { position: 'other', context: 'partial grouping label' };
  }

  const groupingParent = labelNode.parent?.parent;
  if (groupingParent?.type.id !== AggregateModifier) {
    // on(...) / ignoring(...) / group_left(...) grouping labels of binary expressions
    return { position: 'other', context: nodeContext(labelNode) };
  }

  if (!groupingParent.getChild(By)) {
    return { position: 'other', context: 'without() grouping' };
  }

  return { position: 'groupByLabel' };
}

function nodeContext(node: SyntaxNode): string {
  return node.parent ? `${node.parent.name} > ${node.name}` : node.name;
}

function treeHasError(tree: Tree): boolean {
  let hasError = false;

  tree.iterate({
    enter: (node) => {
      if (node.type.isError) {
        hasError = true;
        return false;
      }
      return;
    },
  });

  return hasError;
}
