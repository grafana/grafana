// @ts-check
//https://github.com/jsx-eslint/eslint-plugin-react/blob/d97e3ed96afe77a56fdc6fc7bdec11c28bc256e2/lib/rules/jsx-no-literals.js
const { ESLintUtils } = require('@typescript-eslint/utils')

const createRule = ESLintUtils.RuleCreator((name) => `https://github.com/grafana/grafana/blob/main/packages/grafana-eslint-rules/README.md#${name}`);


const messages = {
    invalidPropValue: 'Invalid prop value: "{{text}}"',
    noStringsInAttributes: 'Strings not allowed in attributes: "{{text}}"',
    noStringsInJSX: 'Strings not allowed in JSX files: "{{text}}"',
    literalNotInJSXExpression: 'Missing JSX expression container around literal string: "{{text}}"',
  };
const trimIfString = (value) => {
    if (typeof value === 'string') {
        return value.trim();
    }
    return value;

  }

const rule = createRule({
  create(context) {
    const defaults = {
        noStrings: false,
        ignoreProps: false,
        noAttributeStrings: false,
      };
    
    const config = Object.assign({}, defaults, context.options[0] || {});

    
    const defaultMessageId = () => {
        const ancestorIsJSXElement = arguments.length > 0 && arguments[0];
        if(config.noAttributeStrings && !ancestorIsJSXElement) {
            return 'noStringsInAttributes';
        }
        if(config.noStrings) {
            return 'noStringsInJSX';
        }
        return 'literalNotInJSExpression';
    }
    const getParentIgnoringBinaryExpressions = (node) => {
        let parent = node.parent;
        while (parent.type === 'BinaryExpression') {
            parent = parent.parent;
        }
        return parent;
    }
    const getValidation = (node) => {
        const values = [
            trimIfString(node.raw),
            trimIfString(node.value)
        ];

        const parent = getParentIgnoringBinaryExpressions(node);
        const isParentNodeStandard = () => {
            if( typeof node.value === "string" && parent.type.includes('JSX')) {
                if(config.noAttributeStrings) {
                    return parent.type === 'JSXAttribute' || parent.type === 'JSXElement';
                }
                if(!config.noAttributeStrings) {
                    return parent.type !== 'JSXAttribute';
                }
                // TRANS check here?
            }
        }

        const standard = isParentNodeStandard();
        

    }

    creatreturn {
      JSXAttribute(node) {



    };
  },

  name: 'no-untranslated-literals',
  meta: {
    docs: {
      description: 'String literals should be translated using the i18n service',
    },
    messages,
    type: 'suggestion',
    schema: [{
        type: 'object',
      properties: {
        noStrings: {
          type: 'boolean',
        },
        allowedStrings: {
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'string',
          },
        },
        ignoreProps: {
          type: 'boolean',
        },
        noAttributeStrings: {
          type: 'boolean',
        },
      },
      additionalProperties: false,
    }],
  },
  defaultOptions: [],
});

module.exports = rule;


