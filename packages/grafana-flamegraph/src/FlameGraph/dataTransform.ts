import {
  createTheme,
  DataFrame,
  DisplayProcessor,
  Field,
  FieldType,
  getDisplayProcessor,
  GrafanaTheme2,
} from '@grafana/data';

import { SampleUnit } from '../types';

import { mergeParentSubtrees, mergeSubtrees } from './treeTransforms';

export type LevelItem = {
  // Offset from the start of the level.
  start: number;
  // Value here can be different from a value of items in the data frame as for callers tree in sandwich view we have
  // to trim the value to correspond only to the part used by the children in the subtree.
  // In case of diff profile this is actually left + right value.
  value: number;
  // Only exists for diff profiles.
  valueRight?: number;
  // Index into the data frame. It is an array because for sandwich views we may be merging multiple items into single
  // node.
  itemIndexes: number[];
  children: LevelItem[];
  level: number;
  parents?: LevelItem[];
};

export type CollapseConfig = {
  items: LevelItem[];
  collapsed: boolean;
};

/**
 * Convert data frame with nested set format into array of level. This is mainly done for compatibility with current
 * rendering code.
 */
export function nestedSetToLevels(
  container: FlameGraphDataContainer,
  options?: Options
): [LevelItem[][], Record<string, LevelItem[]>, CollapsedMap] {
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
      offset =
        lastSibling.start +
        container.getValue(lastSibling.itemIndexes[0]) +
        container.getValueRight(lastSibling.itemIndexes[0]);
      // we assume there is always a single root node so lastSibling should always have a parent.
      // Also it has to have the same parent because of how the items are ordered.
      parent = lastSibling.parents![0];
    }

    const newItem: LevelItem = {
      itemIndexes: [i],
      value: container.getValue(i) + container.getValueRight(i),
      valueRight: container.isDiffFlamegraph() ? container.getValueRight(i) : undefined,
      start: offset,
      parents: parent && [parent],
      children: [],
      level: currentLevel,
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

  const collapsedMapContainer = new CollapsedMapBuilder(options?.collapsingThreshold);
  if (options?.collapsing) {
    // We collapse similar items here, where it seems like parent and child are the same thing and so the distinction
    // isn't that important. We create a map of items that should be collapsed together. We need to do it with complete
    // tree as we need to know how many children an item has to know if we can collapse it.
    collapsedMapContainer.addTree(levels[0][0]);
  }

  return [levels, uniqueLabels, collapsedMapContainer.getCollapsedMap()];
}

/**
 * Small wrapper around the map of items that should be visually collapsed in the flame graph. Reason this is a wrapper
 * is that we want to make sure that when this is in the state we don't update the map directly but create a new map
 * and to have a place for the methods to collapse/expand either single item or all the items.
 */
export class CollapsedMap {
  // The levelItem used as a key is the item that will always be rendered in the flame graph. The config.items are all
  // the items that are in the group and if the config.collapsed is true they will be hidden.
  private map: Map<LevelItem, CollapseConfig> = new Map();

  constructor(map?: Map<LevelItem, CollapseConfig>) {
    this.map = map || new Map();
  }

  get(item: LevelItem) {
    return this.map.get(item);
  }

  keys() {
    return this.map.keys();
  }

  values() {
    return this.map.values();
  }

  size() {
    return this.map.size;
  }

  setCollapsedStatus(item: LevelItem, collapsed: boolean) {
    const newMap = new Map(this.map);
    const collapsedConfig = this.map.get(item)!;
    const newConfig = { ...collapsedConfig, collapsed };
    for (const item of collapsedConfig.items) {
      newMap.set(item, newConfig);
    }
    return new CollapsedMap(newMap);
  }

  setAllCollapsedStatus(collapsed: boolean) {
    const newMap = new Map(this.map);
    for (const item of this.map.keys()) {
      const collapsedConfig = this.map.get(item)!;
      const newConfig = { ...collapsedConfig, collapsed };
      newMap.set(item, newConfig);
    }

    return new CollapsedMap(newMap);
  }
}

/**
 * Similar to CollapsedMap but this one is mutable and used during transformation of the dataFrame data into structure
 * we use for rendering. This should not be passed to the React components.
 */
export class CollapsedMapBuilder {
  private map = new Map();
  private threshold = 0.99;

  constructor(threshold?: number) {
    if (threshold !== undefined) {
      this.threshold = threshold;
    }
  }

  addTree(root: LevelItem) {
    const stack = [root];
    while (stack.length) {
      const current = stack.shift()!;

      if (current.parents?.length) {
        this.addItem(current, current.parents[0]);
      }

      if (current.children.length) {
        stack.unshift(...current.children);
      }
    }
  }

  // The heuristics here is pretty simple right now. Just check if it's single child and if we are within threshold.
  // We assume items with small self just aren't too important while we cannot really collapse items with siblings
  // as it's not clear what to do with said sibling.
  addItem(item: LevelItem, parent?: LevelItem) {
    if (parent && item.value > parent.value * this.threshold && parent.children.length === 1) {
      if (this.map.has(parent)) {
        const config = this.map.get(parent)!;
        this.map.set(item, config);
        config.items.push(item);
      } else {
        const config = { items: [parent, item], collapsed: true };
        this.map.set(parent, config);
        this.map.set(item, config);
      }
    }
  }

  getCollapsedMap() {
    return new CollapsedMap(this.map);
  }
}

export function getMessageCheckFieldsResult(wrongFields: CheckFieldsResult) {
  if (wrongFields.missingFields.length) {
    return `Data is missing fields: ${wrongFields.missingFields.join(', ')}`;
  }

  if (wrongFields.wrongTypeFields.length) {
    return `Data has fields of wrong type: ${wrongFields.wrongTypeFields
      .map((f) => `${f.name} has type ${f.type} but should be ${f.expectedTypes.join(' or ')}`)
      .join(', ')}`;
  }

  return '';
}

export type CheckFieldsResult = {
  wrongTypeFields: Array<{ name: string; expectedTypes: FieldType[]; type: FieldType }>;
  missingFields: string[];
};

export function checkFields(data: DataFrame): CheckFieldsResult | undefined {
  const fields: Array<[string, FieldType[]]> = [
    ['label', [FieldType.string, FieldType.enum]],
    ['level', [FieldType.number]],
    ['value', [FieldType.number]],
    ['self', [FieldType.number]],
  ];

  const missingFields = [];
  const wrongTypeFields = [];

  for (const field of fields) {
    const [name, types] = field;
    const frameField = data?.fields.find((f) => f.name === name);
    if (!frameField) {
      missingFields.push(name);
      continue;
    }
    if (!types.includes(frameField.type)) {
      wrongTypeFields.push({ name, expectedTypes: types, type: frameField.type });
    }
  }

  if (missingFields.length > 0 || wrongTypeFields.length > 0) {
    return {
      wrongTypeFields,
      missingFields,
    };
  }
  return undefined;
}

export type Options = {
  collapsing: boolean;
  collapsingThreshold?: number;
};

export class FlameGraphDataContainer {
  data: DataFrame;
  options: Options;

  labelField: Field;
  levelField: Field;
  valueField: Field;
  selfField: Field;

  // Optional fields for diff view
  valueRightField?: Field;
  selfRightField?: Field;

  labelDisplayProcessor: DisplayProcessor;
  valueDisplayProcessor: DisplayProcessor;
  uniqueLabels: string[];

  private levels: LevelItem[][] | undefined;
  private uniqueLabelsMap: Record<string, LevelItem[]> | undefined;
  private collapsedMap: CollapsedMap | undefined;

  constructor(data: DataFrame, options: Options, theme: GrafanaTheme2 = createTheme()) {
    this.data = data;
    this.options = options;

    const wrongFields = checkFields(data);
    if (wrongFields) {
      throw new Error(getMessageCheckFieldsResult(wrongFields));
    }

    this.labelField = data.fields.find((f) => f.name === 'label')!;
    this.levelField = data.fields.find((f) => f.name === 'level')!;
    this.valueField = data.fields.find((f) => f.name === 'value')!;
    this.selfField = data.fields.find((f) => f.name === 'self')!;

    this.valueRightField = data.fields.find((f) => f.name === 'valueRight')!;
    this.selfRightField = data.fields.find((f) => f.name === 'selfRight')!;

    if ((this.valueField || this.selfField) && !(this.valueField && this.selfField)) {
      throw new Error(
        'Malformed dataFrame: both valueRight and selfRight has to be present if one of them is present.'
      );
    }

    const enumConfig = this.labelField?.config?.type?.enum;
    // Label can actually be an enum field so depending on that we have to access it through display processor. This is
    // both a backward compatibility but also to allow using a simple dataFrame without enum config. This would allow
    // users to use this panel with correct query from data sources that do not return profiles natively.
    if (enumConfig) {
      this.labelDisplayProcessor = getDisplayProcessor({ field: this.labelField, theme });
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

  isDiffFlamegraph() {
    return Boolean(this.valueRightField && this.selfRightField);
  }

  getLabel(index: number) {
    return this.labelDisplayProcessor(this.labelField.values[index]).text;
  }

  getLevel(index: number) {
    return this.levelField.values[index];
  }

  getValue(index: number | number[]) {
    return fieldAccessor(this.valueField, index);
  }

  getValueRight(index: number | number[]) {
    return fieldAccessor(this.valueRightField, index);
  }

  getSelf(index: number | number[]) {
    return fieldAccessor(this.selfField, index);
  }

  getSelfRight(index: number | number[]) {
    return fieldAccessor(this.selfRightField, index);
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

  getSandwichLevels(label: string): [LevelItem[][], LevelItem[][]] {
    const nodes = this.getNodesWithLabel(label);

    if (!nodes?.length) {
      return [[], []];
    }

    const callers = mergeParentSubtrees(nodes, this);
    const callees = mergeSubtrees(nodes, this);

    return [callers, callees];
  }

  getNodesWithLabel(label: string) {
    this.initLevels();
    return this.uniqueLabelsMap![label];
  }

  getCollapsedMap() {
    this.initLevels();
    return this.collapsedMap!;
  }

  private initLevels() {
    if (!this.levels) {
      const [levels, uniqueLabelsMap, collapsedMap] = nestedSetToLevels(this, this.options);
      this.levels = levels;
      this.uniqueLabelsMap = uniqueLabelsMap;
      this.collapsedMap = collapsedMap;
    }
  }
}

// Access field value with either single index or array of indexes. This is needed as we sometimes merge multiple
// into one, and we want to access aggregated values.
function fieldAccessor(field: Field | undefined, index: number | number[]) {
  if (!field) {
    return 0;
  }
  let indexArray: number[] = typeof index === 'number' ? [index] : index;
  return indexArray.reduce((acc, index) => {
    return acc + field.values[index];
  }, 0);
}
