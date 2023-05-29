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

export type LevelItem = { start: number; itemIndex: number; children: LevelItem[]; parent?: LevelItem };

/**
 * Convert data frame with nested set format into array of level. This is mainly done for compatibility with current
 * rendering code.
 */
export function nestedSetToLevels(container: FlameGraphDataContainer): LevelItem[][] {
  const levels: LevelItem[][] = [];
  let offset = 0;

  let parent: LevelItem | undefined = undefined;

  for (let i = 0; i < container.data.length; i++) {
    const currentLevel = container.getLevel(i);
    const prevLevel = i > 0 ? container.getLevel(i - 1) : undefined;

    levels[currentLevel] = levels[currentLevel] || [];

    if (prevLevel && prevLevel >= currentLevel) {
      // We are going down a level or staying at the same level, so we are adding a sibling to the last item in a level.
      // So we have to compute the correct offset based on the last sibling.
      const lastItem = levels[currentLevel][levels[currentLevel].length - 1];
      offset = lastItem.start + container.getValue(lastItem.itemIndex);
      parent = lastItem;
    }

    const newItem: LevelItem = {
      itemIndex: i,
      start: offset,
      parent,
      children: [],
    };
    if (parent) {
      parent.children.push(newItem);
    }
    parent = newItem;

    levels[currentLevel].push(newItem);
  }
  return levels;
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

  getValue(index: number) {
    return this.valueField.values[index];
  }

  getValueDisplay(index: number) {
    return this.valueDisplayProcessor(this.valueField.values[index]);
  }

  getSelf(index: number) {
    return this.selfField.values[index];
  }

  getSelfDisplay(index: number) {
    return this.valueDisplayProcessor(this.selfField.values[index]);
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
    if (!this.levels) {
      this.levels = nestedSetToLevels(this);
    }
    return this.levels;
  }

  getTree() {
    if (!this.levels) {
      this.levels = nestedSetToLevels(this);
    }
    return this.levels[0][0];
  }
}
