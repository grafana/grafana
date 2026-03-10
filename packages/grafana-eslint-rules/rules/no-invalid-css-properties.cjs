const { ESLintUtils, AST_NODE_TYPES } = require('@typescript-eslint/utils');
const { all: allCssProperties } = require('known-css-properties');
const htmlTagsModule = require('html-tags');

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`
);

// Get valid CSS properties from the known-css-properties package
// This package maintains an up-to-date list of all standard CSS properties
// It's the same package used by Stylelint for property validation
const VALID_CSS_PROPERTIES = new Set(allCssProperties);

// HTML tags used as nested selectors in CSS-in-JS
// Using the html-tags package (same as Stylelint uses)
const htmlTags = htmlTagsModule.default || htmlTagsModule;
const HTML_TAGS = new Set(htmlTags);

// Regex to match CSS selector characters (nested selectors, pseudo-classes, etc.)
const SELECTOR_PATTERN = /[&:[\]>+~@]/;

// Valid keyframe selectors
const KEYFRAME_SELECTORS = new Set(['from', 'to']);

function isValidProperty(propertyName) {
  // Allow CSS custom properties (variables)
  if (propertyName.startsWith('--')) {
    return true;
  }

  // Allow nested selectors and at-rules (CSS-in-JS feature)
  // Examples: '&:hover', '& > div', '[disabled]', '@media', etc.
  if (SELECTOR_PATTERN.test(propertyName)) {
    return true;
  }

  // Allow valid HTML tags used as nested selectors
  if (HTML_TAGS.has(propertyName.toLowerCase())) {
    return true;
  }

  // Allow keyframe selectors (from, to)
  if (KEYFRAME_SELECTORS.has(propertyName)) {
    return true;
  }

  // Check against valid CSS properties from known-css-properties
  // Convert camelCase to kebab-case (also handles vendor prefixes)
  const kebabCase = propertyName.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
  return VALID_CSS_PROPERTIES.has(kebabCase);
}

function isInsideFunctionCall(node) {
  // Check if this property is an argument to a function call (not a CSS property)
  // by looking at the immediate context
  let parent = node.parent;

  // Walk up to find the ObjectExpression that contains this property
  while (parent && parent.type !== AST_NODE_TYPES.ObjectExpression) {
    parent = parent.parent;
  }

  if (!parent) {
    return false;
  }

  // Check if the ObjectExpression is an argument to a CallExpression
  const objectParent = parent.parent;
  if (objectParent && objectParent.type === AST_NODE_TYPES.CallExpression && objectParent.arguments.includes(parent)) {
    // Make sure it's not the css() call itself - that's the top level
    if (objectParent.callee.type === AST_NODE_TYPES.Identifier && objectParent.callee.name === 'css') {
      return false;
    }
    // This object is a function argument, not a CSS object
    return true;
  }

  return false;
}

function isInsideKeyframes(node) {
  // Check if this property is inside a @keyframes rule
  let parent = node.parent;

  while (parent) {
    // If parent is a Property with a key that starts with '@keyframes'
    if (parent.type === AST_NODE_TYPES.Property) {
      const key = parent.key;
      if (key.type === AST_NODE_TYPES.Literal && typeof key.value === 'string') {
        if (key.value.startsWith('@keyframes')) {
          return true;
        }
      }
      if (key.type === AST_NODE_TYPES.Identifier && key.name.startsWith('@keyframes')) {
        return true;
      }
    }
    parent = parent.parent;
  }

  return false;
}

const invalidCssPropertiesRule = createRule({
  create(context) {
    return {
      [`${AST_NODE_TYPES.CallExpression}[callee.name="css"] ${AST_NODE_TYPES.Property}`]: function (node) {
        if (
          node.type === AST_NODE_TYPES.Property &&
          node.key.type === AST_NODE_TYPES.Identifier &&
          !node.computed // Skip computed properties like [narrowScreenQuery]: {...}
        ) {
          const propertyName = node.key.name;

          // Skip properties that are inside function calls (not direct CSS properties)
          if (isInsideFunctionCall(node)) {
            return;
          }

          // Skip properties that are inside @keyframes rules
          if (isInsideKeyframes(node)) {
            return;
          }

          if (!isValidProperty(propertyName)) {
            context.report({
              node: node.key,
              messageId: 'invalidProperty',
              data: {
                propertyName,
              },
            });
          }
        }
      },
    };
  },
  name: 'no-invalid-css-properties',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow invalid CSS property names in Emotion css() calls',
    },
    messages: {
      invalidProperty:
        'Invalid CSS property "{{propertyName}}" in css() call. This property will be ignored by browsers.',
    },
    schema: [],
  },
  defaultOptions: [],
});

module.exports = invalidCssPropertiesRule;
