import { createDataFrame } from '@grafana/data';

type TreeNode = {
  label: string;
  level: number;
  value: number;
  start: number;
  self: number;
  children: TreeNode[];
};

export function textToTree(text: string) {
  const levels = text.split('\n');
  if (levels[0] === '') {
    levels.shift();
  }

  const margin = levels[0].indexOf('[');
  const root: TreeNode = {
    label: 'root',
    level: 0,
    value: levels[0].length - margin,
    start: 0,
    self: levels[0].length - margin,
    children: [],
  };

  let prevLevel = [root];
  const re = /\[(\d)[^\[]*]/g;
  let match;

  for (let i = 0; i < levels.length; i++) {
    const newLevel = [];
    while ((match = re.exec(levels[i])) !== null) {
      const node: TreeNode = {
        label: match[1],
        level: i + 1,
        value: match[0].length,
        start: match.index - margin,
        self: match[0].length,
        children: [],
      };

      newLevel.push(node);

      for (const n of prevLevel) {
        if (n.start + n.value > node.start) {
          n.children.push(node);
          n.self = n.self - node.value;
          break;
        }
      }
    }
    prevLevel = newLevel;
  }

  return root;
}

type Field<T = number> = { name: string; values: T[] };

export function treeToDataFrame(root: TreeNode) {
  const levelField: Field = { name: 'level', values: [] };
  const valueField: Field = { name: 'value', values: [] };
  const labelField: Field<string> = { name: 'label', values: [] };
  const selfField: Field<number> = { name: 'self', values: [] };

  let stack = [root];

  while (stack.length) {
    const node = stack.shift()!;
    levelField.values.push(node.level);
    valueField.values.push(node.value);
    labelField.values.push(node.label);
    selfField.values.push(node.self);
    stack = [...node.children, ...stack];
  }

  return createDataFrame({
    fields: [levelField, valueField, selfField, labelField],
  });
}

export function frameFromText(text: string) {
  return treeToDataFrame(textToTree(text));
}
