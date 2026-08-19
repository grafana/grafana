// @ts-check
const { ESLintUtils } = require('@typescript-eslint/utils');

/**
 * @typedef {import('@typescript-eslint/utils').TSESTree.Property} Property
 * @typedef {import('@typescript-eslint/utils').TSESTree.Expression} Expression
 * @typedef {import('@typescript-eslint/utils').TSESTree.ArrowFunctionExpression} ArrowFunctionExpression
 * @typedef {import('@typescript-eslint/utils').TSESTree.FunctionExpression} FunctionExpression
 */

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

// selector leaves live under version keys, e.g. { '9.4.0': fn } or { [MIN_GRAFANA_VERSION]: fn }.
// a version-like key tells us the function is a selector value rather than some unrelated helper.
const VERSION_KEY = /^\d+\.\d+/;

/**
 * @param { Property } property
 * @returns { boolean }
 */
function isVersionKey(property) {
  const { key, computed } = property;
  if (!computed && key.type === 'Literal' && typeof key.value === 'string') {
    return VERSION_KEY.test(key.value);
  }
  if (computed && key.type === 'Identifier') {
    return key.name === 'MIN_GRAFANA_VERSION';
  }
  return false;
}

/**
 * @param { ArrowFunctionExpression | FunctionExpression } fn
 * @returns { Set<string> }
 */
function paramNames(fn) {
  const names = new Set();
  for (const param of fn.params) {
    if (param.type === 'Identifier') {
      names.add(param.name);
    } else if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
      names.add(param.left.name);
    }
  }
  return names;
}

// resolves to a plain string with only direct parameter interpolation:
//   'foo'            -> string literal
//   `foo`            -> template with no expressions
//   `foo ${x}`       -> template interpolating bare parameters only
//   x                -> a parameter returned directly (identity)
/**
 * @param { Expression } node
 * @param { Set<string> } params
 * @returns { boolean }
 */
function isPlainStringExpression(node, params) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return true;
  }
  if (node.type === 'Identifier') {
    return params.has(node.name);
  }
  if (node.type === 'TemplateLiteral') {
    return node.expressions.every((expr) => expr.type === 'Identifier' && params.has(expr.name));
  }
  return false;
}

// the serializable function-body shapes the generator can round-trip:
//   a plain-string expression, or
//   a single present/absent conditional: `x ? <plainString> : <plainString>`
/**
 * @param { Expression } node
 * @param { Set<string> } params
 * @returns { boolean }
 */
function isSerializableBody(node, params) {
  if (isPlainStringExpression(node, params)) {
    return true;
  }
  // the generator only emits the two-branch present/absent template for single-arg selectors, so a
  // conditional is only serializable with exactly one parameter. a multi-arg ternary would otherwise
  // pass lint but serialize as a single always-present branch.
  if (node.type === 'ConditionalExpression') {
    return (
      params.size === 1 &&
      node.test.type === 'Identifier' &&
      params.has(node.test.name) &&
      isPlainStringExpression(node.consequent, params) &&
      isPlainStringExpression(node.alternate, params)
    );
  }
  return false;
}

/**
 * @param { ArrowFunctionExpression | FunctionExpression } fn
 * @returns { Expression | null }
 */
function selectorBody(fn) {
  if (fn.body.type === 'BlockStatement') {
    const statements = fn.body.body;
    if (statements.length === 1 && statements[0].type === 'ReturnStatement' && statements[0].argument) {
      return statements[0].argument;
    }
    // anything more than a single return is not serializable
    return null;
  }
  return fn.body;
}

const rule = createRule({
  create(context) {
    /** @param { ArrowFunctionExpression | FunctionExpression } fn */
    function check(fn) {
      const parent = fn.parent;
      if (!parent || parent.type !== 'Property' || parent.value !== fn || !isVersionKey(parent)) {
        return;
      }
      const body = selectorBody(fn);
      if (!body || !isSerializableBody(body, paramNames(fn))) {
        context.report({ node: body ?? fn, messageId: 'notSerializable' });
      }
    }

    return {
      ArrowFunctionExpression: check,
      FunctionExpression: check,
    };
  },

  name: 'serializable-e2e-selectors',
  meta: {
    docs: {
      description:
        'e2e selector functions must be serializable to public/e2e-selectors.json for runtime delivery to @grafana/plugin-e2e',
    },
    messages: {
      notSerializable:
        'Selector functions must interpolate their parameters directly into a template literal (or use the `(x) => (x ? `...${x}...` : `...`)` conditional form) so they can be serialized for runtime delivery. Avoid method calls, operators or other logic in selector functions.',
    },
    type: 'problem',
    schema: [],
  },
  defaultOptions: [],
});

module.exports = rule;
