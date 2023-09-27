import { arrayToDataFrame } from '@grafana/data';

import { FlameGraphDataContainer, LevelItem } from './dataTransform';

// Convert text to a FlameGraphDataContainer for testing. The format representing the flamegraph for example:
// [0///////]
// [1//][4//]
// [2//][5]
// [3]  [6]
//      [7]
// Each node starts with [ ends with ], single digit is used for label and the length of a node is it's value.
export function textToDataContainer(text: string) {
  const levels = text.split('\n');

  if (levels.length === 0) {
    return undefined;
  }

  if (levels[0] === '') {
    levels.shift();
  }

  const dfValues: Array<{ level: number; value: number; label: string; self: number }> = [];
  const dfSorted: Array<{ level: number; value: number; label: string; self: number }> = [];
  const leftMargin = levels[0].indexOf('[');

  let itemLevels: LevelItem[][] = [];
  const re = /\[(\d)[^\[]*]/g;
  let match;

  for (let i = 0; i < levels.length; i++) {
    while ((match = re.exec(levels[i])) !== null) {
      const currentNodeValue = match[0].length;
      dfValues.push({
        value: match[0].length,
        label: match[1],
        self: match[0].length,
        level: i,
      });

      const node: LevelItem = {
        value: match[0].length,
        itemIndexes: [dfValues.length - 1],
        start: match.index - leftMargin,
        children: [],
      };

      itemLevels[i] = itemLevels[i] || [];
      itemLevels[i].push(node);
      const prevLevel = itemLevels[i - 1];

      if (prevLevel) {
        for (const n of prevLevel) {
          const nRow = dfValues[n.itemIndexes[0]];
          const value = nRow.value;
          if (n.start + value > node.start) {
            n.children.push(node);
            nRow.self = nRow.self - currentNodeValue;
            break;
          }
        }
      }
    }
  }

  const root = itemLevels[0][0];

  const stack = [root];
  while (stack.length) {
    const node = stack.shift()!;
    const index = node.itemIndexes[0];
    dfSorted.push(dfValues[index]);
    node.itemIndexes = [dfSorted.length - 1];
    if (node.children) {
      stack.unshift(...node.children);
    }
  }

  const df = arrayToDataFrame(dfSorted);
  return new FlameGraphDataContainer(df);
}

export function trimLevelsString(s: string) {
  const lines = s.split('\n').filter((l) => !l.match(/^\s*$/));
  const offset = Math.min(lines[0].indexOf('['), lines[lines.length - 1].indexOf('['));
  return lines.map((l) => l.substring(offset)).join('\n');
}

// Convert levels array to a string representation that can be visually compared. Mainly useful together with
// textToDataContainer to create more visual tests.
export function levelsToString(levels: LevelItem[][], data: FlameGraphDataContainer) {
  let sLevels = [];
  for (const level of levels) {
    let sLevel = ' '.repeat(level[0].start);
    for (const node of level) {
      sLevel += ' '.repeat(node.start - sLevel.length);
      sLevel += `[${data.getLabel(node.itemIndexes[0])}${'/'.repeat(node.value - 3)}]`;
    }
    sLevels.push(sLevel);
  }
  return sLevels.join('\n');
}
