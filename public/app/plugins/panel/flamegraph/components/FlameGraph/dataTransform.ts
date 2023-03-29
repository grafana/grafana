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

export type LevelItem = { start: number; itemIndex: number };

/**
 * Convert data frame with nested set format into array of level. This is mainly done for compatibility with current
 * rendering code.
 */
export function nestedSetToLevels(container: FlameGraphDataContainer): LevelItem[][] {
  const levels: LevelItem[][] = [];
  let offset = 0;

  for (let i = 0; i < container.data.length; i++) {
    const currentLevel = container.getLevel(i);
    const prevLevel = i > 0 ? container.getLevel(i - 1) : undefined;

    levels[currentLevel] = levels[currentLevel] || [];
    if (prevLevel && prevLevel >= currentLevel) {
      // We are going down a level or staying at the same level, so we are adding a sibling to the last item in a level.
      // So we have to compute the correct offset based on the last sibling.
      const lastItem = levels[currentLevel][levels[currentLevel].length - 1];
      offset = lastItem.start + container.getValue(lastItem.itemIndex);
    }
    const newItem: LevelItem = {
      itemIndex: i,
      start: offset,
    };

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
      this.uniqueLabels = [...new Set<string>(this.labelField.values.toArray())];
    }

    this.valueDisplayProcessor = getDisplayProcessor({
      field: this.valueField,
      theme,
    });
  }

  getLabel(index: number) {
    return this.labelDisplayProcessor(this.labelField.values.get(index)).text;
  }

  getLevel(index: number) {
    return this.levelField.values.get(index);
  }

  getValue(index: number) {
    return this.valueField.values.get(index);
  }

  getValueDisplay(index: number) {
    return this.valueDisplayProcessor(this.valueField.values.get(index));
  }

  getSelf(index: number) {
    return this.selfField.values.get(index);
  }

  getSelfDisplay(index: number) {
    return this.valueDisplayProcessor(this.selfField.values.get(index));
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
}
