import { type Config, type JsonTree, Utils } from '@react-awesome-query-builder/ui';

import { raqbConfig } from './AwesomeQueryBuilder';

const config: Config = {
  ...raqbConfig,
  fields: {
    name: { label: 'Name', type: 'text', valueSources: ['value'] },
  },
};

function ruleTree(operator: string, value: string): JsonTree {
  return {
    id: Utils.uuid(),
    type: 'group',
    children1: [
      {
        type: 'rule',
        properties: { field: 'name', operator, value: [value], valueSrc: ['value'], valueType: ['text'] },
      },
    ],
  };
}

function toSql(tree: JsonTree): string | undefined {
  return Utils.sqlFormat(Utils.checkTree(Utils.loadTree(tree), config), config);
}

describe('query builder list operators', () => {
  it('quotes each comma-separated value of "Any in" separately', () => {
    expect(toSql(ruleTree('select_any_in', 'a, b,c'))).toBe("name IN ('a', 'b', 'c')");
  });

  it('quotes each comma-separated value of "Not in" separately', () => {
    expect(toSql(ruleTree('select_not_any_in', 'a, b,c'))).toBe("name NOT IN ('a', 'b', 'c')");
  });

  it('escapes quotes inside each value', () => {
    expect(toSql(ruleTree('select_any_in', "O'Brien, it's"))).toBe("name IN ('O\\'Brien', 'it\\'s')");
  });

  it('keeps a single value as one literal', () => {
    expect(toSql(ruleTree('select_any_in', 'a'))).toBe("name IN ('a')");
  });

  it('formats other text operators unchanged', () => {
    expect(toSql(ruleTree('equal', 'a, b'))).toBe("name = 'a, b'");
  });
});
