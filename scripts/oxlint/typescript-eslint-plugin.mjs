// typescript-eslint rules that oxlint doesn't implement natively. They demand parser services even when
// they don't need type information, and oxlint doesn't provide any, so give them empty ones.
import tsPlugin from '@typescript-eslint/eslint-plugin';

const ruleNames = ['naming-convention'];
const parserServices = { program: null, esTreeNodeToTSNodeMap: new WeakMap(), tsNodeToESTreeNodeMap: new WeakMap() };

function withParserServices(rule) {
  return {
    ...rule,
    create(context) {
      // oxlint freezes these properties, so shadow them on derived objects rather than proxying.
      const sourceCode = Object.create(context.sourceCode, { parserServices: { value: parserServices } });
      return rule.create(Object.create(context, { sourceCode: { value: sourceCode } }));
    },
  };
}

export default {
  meta: { name: 'typescript-js' },
  rules: Object.fromEntries(ruleNames.map((name) => [name, withParserServices(tsPlugin.rules[name])])),
};
