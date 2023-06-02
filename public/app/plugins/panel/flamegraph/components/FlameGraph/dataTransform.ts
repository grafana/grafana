import { groupBy } from 'lodash';

import {
  createTheme,
  DataFrame,
  DisplayProcessor,
  Field,
  getDisplayProcessor,
  getEnumDisplayProcessor,
  GrafanaTheme2,
} from '@grafana/data';

import { SampleUnit } from '../types';

import { mergeSubtrees } from './treeTransforms';

export type LevelItem = { start: number; itemIndexes: number[]; children: LevelItem[]; parents?: LevelItem[] };

/**
 * Convert data frame with nested set format into array of level. This is mainly done for compatibility with current
 * rendering code.
 */
export function nestedSetToLevels(container: FlameGraphDataContainer): [LevelItem[][], Record<string, LevelItem[]>] {
  const levels: LevelItem[][] = [];
  let offset = 0;

  let parent: LevelItem | undefined = undefined;
  const uniqueLabels: Record<string, LevelItem[]> = {};

  for (let i = 0; i < container.data.length; i++) {
    const currentLevel = container.getLevel(i);
    const prevLevel = i > 0 ? container.getLevel(i - 1) : undefined;

    levels[currentLevel] = levels[currentLevel] || [];

    if (prevLevel && prevLevel >= currentLevel) {
      // We are going down a level or staying at the same level, so we are adding a sibling to the last item in a level.
      // So we have to compute the correct offset based on the last sibling.
      const lastSibling = levels[currentLevel][levels[currentLevel].length - 1];
      offset = lastSibling.start + container.getValue(lastSibling.itemIndexes[0]);
      // we assume there is always a single root node so lastSibling should always have a parent.
      // Also it has to have the same parent because of how the items are ordered.
      parent = lastSibling.parents![0];
    }

    const newItem: LevelItem = {
      itemIndexes: [i],
      start: offset,
      parents: parent && [parent],
      children: [],
    };

    if (uniqueLabels[container.getLabel(i)]) {
      uniqueLabels[container.getLabel(i)].push(newItem);
    } else {
      uniqueLabels[container.getLabel(i)] = [newItem];
    }

    if (parent) {
      parent.children.push(newItem);
    }
    parent = newItem;

    levels[currentLevel].push(newItem);
  }

  return [levels, uniqueLabels];
}

export class FlameGraphDataContainer {
  data: DataFrame;
  labelField: Field;
  levelField: Field;
  valueField: Field;
  selfField: Field;

  labelDisplayProcessor: DisplayProcessor;
  valueDisplayProcessor: DisplayProcessor;
  uniqueLabels: string[];

  private levels: LevelItem[][] | undefined;
  private uniqueLabelsMap: Record<string, LevelItem[]> | undefined;

  constructor(data: DataFrame, theme: GrafanaTheme2 = createTheme()) {
    this.data = data;
    this.labelField = data.fields.find((f) => f.name === 'label')!;
    this.levelField = data.fields.find((f) => f.name === 'level')!;
    this.valueField = data.fields.find((f) => f.name === 'value')!;
    this.selfField = data.fields.find((f) => f.name === 'self')!;

    if (!(this.labelField && this.levelField && this.valueField && this.selfField)) {
      throw new Error('Malformed dataFrame: value, level and label and self fields are required.');
    }

    const enumConfig = this.labelField?.config?.type?.enum;
    // Label can actually be an enum field so depending on that we have to access it through display processor. This is
    // both a backward compatibility but also to allow using a simple dataFrame without enum config. This would allow
    // users to use this panel with correct query from data sources that do not return profiles natively.
    if (enumConfig) {
      this.labelDisplayProcessor = getEnumDisplayProcessor(theme, enumConfig);
      this.uniqueLabels = enumConfig.text || [];
    } else {
      this.labelDisplayProcessor = (value) => ({
        text: value + '',
        numeric: 0,
      });
      this.uniqueLabels = [...new Set<string>(this.labelField.values)];
    }

    this.valueDisplayProcessor = getDisplayProcessor({
      field: this.valueField,
      theme,
    });
  }

  getLabel(index: number) {
    return this.labelDisplayProcessor(this.labelField.values[index]).text;
  }

  getLevel(index: number) {
    return this.levelField.values[index];
  }

  getValue(index: number | number[]) {
    let indexArray: number[] = typeof index === 'number' ? [index] : index;
    return indexArray.reduce((acc, index) => {
      return acc + this.valueField.values[index];
    }, 0);
  }

  getValueDisplay(index: number | number[]) {
    return this.valueDisplayProcessor(this.getValue(index));
  }

  getSelf(index: number | number[]) {
    let indexArray: number[] = typeof index === 'number' ? [index] : index;
    return indexArray.reduce((acc, index) => {
      return acc + this.selfField.values[index];
    }, 0);
  }

  getSelfDisplay(index: number | number[]) {
    return this.valueDisplayProcessor(this.getSelf(index));
  }

  getUniqueLabels() {
    return this.uniqueLabels;
  }

  getUnitTitle() {
    switch (this.valueField.config.unit) {
      case SampleUnit.Bytes:
        return 'RAM';
      case SampleUnit.Nanoseconds:
        return 'Time';
    }

    return 'Count';
  }

  getLevels() {
    this.initLevels();
    return this.levels!;
  }

  getTree() {
    this.initLevels();
    return this.levels![0][0];
  }

  getCallersTree(label: string) {
    const nodes = this.getNodesWithLabel(label);
    if (nodes?.length <= 1) {
      return nodes && nodes[0];
    }

    let superNode: LevelItem = {
      start: 0,
      itemIndexes: [],
      children: [],
      parents: nodes,
    };

    collapseParentNodes(this, superNode);
    return superNode.parents![0];
  }

  getCalleesTree(label: string) {
    const nodes = this.getNodesWithLabel(label);

    if (!nodes?.length) {
      return [];
    }

    return mergeSubtrees(nodes, this);
  }

  getNodesWithLabel(label: string) {
    this.initLevels();
    return this.uniqueLabelsMap![label];
  }

  private initLevels() {
    if (!this.levels) {
      const [levels, uniqueLabelsMap] = nestedSetToLevels(this);
      this.levels = levels;
      this.uniqueLabelsMap = uniqueLabelsMap;
    }
  }
}

function collapseParentNodes(data: FlameGraphDataContainer, node: LevelItem) {
  if (!node.parents?.length || node.parents?.length === 1) {
    return;
  }

  const groups = groupBy(node.parents, (i) => data.getLabel(i.itemIndexes[0]));

  const newParents = [];

  for (const k of Object.keys(groups)) {
    if (groups[k].length > 1) {
      const items = groups[k];
      const superNode: LevelItem = {
        start: 0,
        itemIndexes: items.flatMap((i) => i.itemIndexes),
        parents: items.flatMap((i) => i.parents || []),
        children: items[0].children,
      };
      collapseParentNodes(data, superNode);
      newParents.push(superNode);
    } else {
      newParents.push(groups[k][0]);
    }
  }
  node.parents = newParents;
}
