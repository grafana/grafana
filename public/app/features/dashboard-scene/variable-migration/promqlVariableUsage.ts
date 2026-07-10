import { type SyntaxNode, type Tree } from '@lezer/common';
import {
  AggregateModifier,
  By,
  GroupingLabels,
  Identifier,
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

const variableSyntaxBuilders: Array<(name: string, fmt?: string) => string> = [
  (name) => `$${name}`,
  (name, fmt) => `[[${name}${fmt ? `:${fmt}` : ''}]]`,
  (name, fmt) => `\${${name}${fmt ? `:${fmt}` : ''}}`,
];

function returnVariables(expr: string): string {
  return expr.replace(/__V_(\d)__(.+?)__V__(?:__F__(\w+)__F__)?/g, (match, type, name, fmt) => {
    return variableSyntaxBuilders[parseInt(type, 10)](name, fmt);
  });
}

/**
 * The placeholder trick is lossy for `${var.fieldPath}` references (the field path is not
 * encoded) and for format specifiers with non-word characters (not restorable). Expressions
 * containing either cannot be safely round-tripped, so classification/rewriting refuses them.
 */
export function hasUnsupportedVariableSyntax(expr: string): boolean {
  for (const match of expr.matchAll(variableRegex)) {
    const fieldPath = match[5];
    const format = match[3] ?? match[6];
    if (fieldPath !== undefined || (format !== undefined && /\W/.test(format))) {
      return true;
    }
  }
  return false;
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

const builtInReplacementRegex = new RegExp(BUILT_IN_VARIABLES.map(({ replacement }) => replacement).join('|'), 'g');

function replaceBuiltInVariables(expr: string): string {
  return expr.replace(builtInVariableRegex, (match) => {
    return BUILT_IN_VARIABLES.find((v) => v.variable === match)?.replacement ?? match;
  });
}

function returnBuiltInVariables(expr: string): string {
  return expr.replace(builtInReplacementRegex, (match) => {
    return BUILT_IN_VARIABLES.find((v) => v.replacement === match)?.variable ?? match;
  });
}

const placeholderPattern = /__V_[0-2]__(\w+?)__V__(?:__F__.+?__F__)?/;

function buildOccurrenceRegex(variableName: string): RegExp {
  return new RegExp(`__V_[0-2]__${variableName}__V__(?:__F__.+?__F__)?`, 'g');
}

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
  | { position: 'filterValue'; labelKey: string; operator: string; format?: string }
  | { position: 'groupByLabel'; format?: string }
  | { position: 'other'; context: string };

export interface ExprVariableUsages {
  /** One entry per occurrence of the variable in the expression, in source order. */
  usages: PromQLVariableUsage[];
  hasParseError: boolean;
  /** See hasUnsupportedVariableSyntax: field paths / exotic formats anywhere in the expr. */
  hasUnsupportedSyntax: boolean;
}

/**
 * Classifies every occurrence of a variable in a PromQL expression by its structural
 * position (lezer parse, no regex guessing):
 * - `filterValue`: the variable is the entire value of a label matcher (`{key=~"$var"}`)
 *   of a selector with a metric name
 * - `groupByLabel`: the variable is a grouping label in a `by(...)` aggregation modifier
 * - `other`: anything else (metric name, function arg, `without(...)`, partial matcher
 *   value, negative matcher, on/ignoring, ...) — callers should treat these as unsafe.
 */
export function classifyVariableUsagesInExpr(expr: string, variableName: string): ExprVariableUsages {
  const replacedExpr = replaceVariables(replaceBuiltInVariables(expr));
  const tree = parser.parse(replacedExpr);

  const usages: PromQLVariableUsage[] = [];

  for (const match of replacedExpr.matchAll(buildOccurrenceRegex(variableName))) {
    usages.push(classifyOccurrence(tree, replacedExpr, match.index, match.index + match[0].length).usage);
  }

  return {
    usages,
    hasParseError: treeHasError(tree),
    hasUnsupportedSyntax: hasUnsupportedVariableSyntax(expr),
  };
}

interface OccurrenceClassification {
  usage: PromQLVariableUsage;
  /** The full matcher node, for filterValue usages. */
  matcherNode?: SyntaxNode;
  /** The grouping LabelName node, for groupByLabel usages. */
  groupingLabelNode?: SyntaxNode;
}

function classifyOccurrence(tree: Tree, expr: string, from: number, to: number): OccurrenceClassification {
  const node = tree.resolveInner(from, 1);

  if (node.type.id === StringLiteral) {
    return classifyStringLiteralOccurrence(node, expr, from, to);
  }

  if (node.type.id === LabelName && node.parent?.type.id === GroupingLabels) {
    return classifyGroupingLabelOccurrence(node, expr, from, to);
  }

  return { usage: { position: 'other', context: nodeContext(node) } };
}

function classifyStringLiteralOccurrence(
  stringNode: SyntaxNode,
  expr: string,
  from: number,
  to: number
): OccurrenceClassification {
  const matcher = stringNode.parent;
  if (!matcher || (matcher.type.id !== UnquotedLabelMatcher && matcher.type.id !== QuotedLabelMatcher)) {
    return { usage: { position: 'other', context: nodeContext(stringNode) } };
  }

  // The variable must be the entire matcher value (only the quotes around it).
  if (from !== stringNode.from + 1 || to !== stringNode.to - 1) {
    return { usage: { position: 'other', context: 'partial label matcher value' } };
  }

  const labelKey = getMatcherLabelKey(matcher, expr);
  if (labelKey === undefined || placeholderPattern.test(labelKey)) {
    return { usage: { position: 'other', context: 'variable label matcher key' } };
  }

  const opNode = matcher.getChild(MatchOp);
  const operator = opNode ? expr.substring(opNode.from, opNode.to) : undefined;
  if (operator !== '=' && operator !== '=~') {
    return { usage: { position: 'other', context: `unsupported matcher operator "${operator}"` } };
  }

  // Removing the matcher must not leave an empty selector, so the selector needs a metric
  // name — either a plain identifier or a quoted (utf8) metric inside the braces.
  if (!selectorHasMetricName(matcher.parent)) {
    return { usage: { position: 'other', context: 'selector without metric name' } };
  }

  return {
    usage: { position: 'filterValue', labelKey, operator, format: getOccurrenceFormat(expr, from, to) },
    matcherNode: matcher,
  };
}

function selectorHasMetricName(labelMatchers: SyntaxNode | null): boolean {
  if (!labelMatchers) {
    return false;
  }
  if (labelMatchers.getChild(QuotedLabelName)) {
    return true;
  }
  return labelMatchers.parent?.getChild(Identifier) != null;
}

function getMatcherLabelKey(matcher: SyntaxNode, expr: string): string | undefined {
  const labelNode = matcher.getChild(LabelName) ?? matcher.getChild(QuotedLabelName);
  if (!labelNode) {
    return undefined;
  }

  const text = expr.substring(labelNode.from, labelNode.to);
  return labelNode.type.id === QuotedLabelName ? text.slice(1, -1) : text;
}

function classifyGroupingLabelOccurrence(
  labelNode: SyntaxNode,
  expr: string,
  from: number,
  to: number
): OccurrenceClassification {
  if (labelNode.from !== from || labelNode.to !== to) {
    return { usage: { position: 'other', context: 'partial grouping label' } };
  }

  const groupingParent = labelNode.parent?.parent;
  if (groupingParent?.type.id !== AggregateModifier) {
    // on(...) / ignoring(...) / group_left(...) grouping labels of binary expressions
    return { usage: { position: 'other', context: nodeContext(labelNode) } };
  }

  if (!groupingParent.getChild(By)) {
    return { usage: { position: 'other', context: 'without() grouping' } };
  }

  return {
    usage: { position: 'groupByLabel', format: getOccurrenceFormat(expr, from, to) },
    groupingLabelNode: labelNode,
  };
}

function getOccurrenceFormat(expr: string, from: number, to: number): string | undefined {
  return expr.substring(from, to).match(/__F__(.+?)__F__$/)?.[1];
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

/**
 * Removes every usage of the given variables from a PromQL expression:
 * - label matchers whose value is one of the variables are removed (and the `{...}` braces
 *   when no matcher remains);
 * - the variables' grouping labels are removed from `by(...)` (the whole `by(...)` modifier
 *   when it becomes empty — the bare aggregation gets its grouping re-injected server-side
 *   by promlib from request.groupByKeys).
 *
 * Purely surgical: everything else in the expression keeps its original formatting.
 * Returns undefined when any usage sits in a position that cannot be safely removed
 * (callers are expected to have run detection first, so this is a defensive signal).
 */
export function removeVariableUsagesFromExpr(expr: string, variableNames: string[]): string | undefined {
  if (hasUnsupportedVariableSyntax(expr)) {
    return undefined;
  }

  const replacedExpr = replaceVariables(replaceBuiltInVariables(expr));
  const tree = parser.parse(replacedExpr);
  if (treeHasError(tree)) {
    return undefined;
  }

  // Keyed by node start offset: node instances are not identity-stable across navigation.
  const removedMatchers = new Map<number, SyntaxNode>();
  const removedGroupingLabels = new Map<number, SyntaxNode>();

  for (const variableName of variableNames) {
    for (const match of replacedExpr.matchAll(buildOccurrenceRegex(variableName))) {
      const classification = classifyOccurrence(tree, replacedExpr, match.index, match.index + match[0].length);

      if (classification.matcherNode) {
        removedMatchers.set(classification.matcherNode.from, classification.matcherNode);
      } else if (classification.groupingLabelNode) {
        removedGroupingLabels.set(classification.groupingLabelNode.from, classification.groupingLabelNode);
      } else {
        return undefined;
      }
    }
  }

  if (removedMatchers.size === 0 && removedGroupingLabels.size === 0) {
    return expr;
  }

  const edits: Array<{ from: number; to: number; insert: string }> = [];

  for (const container of containersOf(removedMatchers.values())) {
    // container is the LabelMatchers node, braces included
    const survivors = childrenOf(container).filter((child) => !removedMatchers.has(child.from));
    edits.push({
      from: container.from,
      to: container.to,
      insert:
        survivors.length === 0
          ? ''
          : `{${survivors.map((child) => replacedExpr.substring(child.from, child.to)).join(', ')}}`,
    });
  }

  for (const container of containersOf(removedGroupingLabels.values())) {
    // container is the GroupingLabels node, parens included
    const survivors = childrenOf(container).filter((child) => !removedGroupingLabels.has(child.from));

    if (survivors.length > 0) {
      edits.push({
        from: container.from,
        to: container.to,
        insert: `(${survivors.map((child) => replacedExpr.substring(child.from, child.to)).join(', ')})`,
      });
    } else {
      const modifier = container.parent;
      if (modifier?.type.id !== AggregateModifier) {
        return undefined;
      }
      const from = modifier.from > 0 && replacedExpr[modifier.from - 1] === ' ' ? modifier.from - 1 : modifier.from;
      edits.push({ from, to: modifier.to, insert: '' });
    }
  }

  edits.sort((a, b) => b.from - a.from);

  let result = replacedExpr;
  for (const edit of edits) {
    result = result.slice(0, edit.from) + edit.insert + result.slice(edit.to);
  }

  return returnBuiltInVariables(returnVariables(result));
}

function containersOf(nodes: Iterable<SyntaxNode>): SyntaxNode[] {
  const containers = new Map<number, SyntaxNode>();
  for (const node of nodes) {
    if (node.parent) {
      containers.set(node.parent.from, node.parent);
    }
  }
  return [...containers.values()];
}

function childrenOf(node: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = [];
  let child = node.firstChild;
  while (child) {
    children.push(child);
    child = child.nextSibling;
  }
  return children;
}
