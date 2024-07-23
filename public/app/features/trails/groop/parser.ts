export { Parser, prefixDelimited };

interface Config {
  minGroupSize: number;
  idealMaxGroupSize: number;
  maxDepth: number;
  miscGroupKey?: string;
}

interface Grouping {
  root: Node;
}

class Parser {
  public config: Config;

  constructor() {
    this.config = {
      minGroupSize: 3,
      idealMaxGroupSize: 30,
      maxDepth: 100,
    };
  }

  parse(values: string[]): Grouping {
    if (this.config.maxDepth <= 0) {
      throw new Error('Max depth must be greater than 0');
    }
    if (this.config.minGroupSize < 1) {
      throw new Error('Min group size must be greater than 0');
    }
    if (this.config.idealMaxGroupSize < this.config.minGroupSize) {
      throw new Error('Max group size must be greater than min group size');
    }
    if (this.config.miscGroupKey && this.config.miscGroupKey === '') {
      throw new Error('miscGroupKey cannot be empty');
    }
    const root = this.parseStrings(values, 0);
    return { root };
  }

  parseStrings(values: string[], level: number): Node {
    const node: Node = {
      groups: new Map(),
      values: [],
      descendants: 0,
    };
    // go through each value and group it by its
    // prefix, for the current level
    for (const value of values) {
      // skip empty values
      if (value.trim() === '') {
        continue;
      }
      const prefix = prefixDelimited(value, level);
      // do we have this group?
      let group = node.groups.get(prefix);
      if (!group) {
        // create a new group
        group = { groups: new Map(), values: [], descendants: 0 };
        node.groups.set(prefix, group);
      }
      // add the value to the group
      group.values.push(value);
      group.descendants++;
    }
    // check if we need to collapse or split any groups
    const miscGroupValues: string[] = [];
    for (let [key, group] of node.groups.entries()) {
      if (group.values.length < this.config.minGroupSize) {
        // this group is too small
        if (this.config.miscGroupKey) {
          // put the values into the miscGroupValues
          miscGroupValues.push(...group.values);
        } else {
          // put the values into the node itself
          node.values.push(...group.values);
        }
        // keep track of the descendants
        node.descendants += group.values.length;
        // remove the group
        node.groups.delete(key);
      } else if (group.values.length > this.config.idealMaxGroupSize && level < this.config.maxDepth - 1) {
        // this group is too big - see if we can split it into
        // subgroups
        group = this.parseStrings(group.values, level + 1);
        node.groups.set(key, group);
        node.descendants += group.descendants;
      } else {
        node.descendants += group.descendants;
      }
    }
    if (this.config.miscGroupKey && miscGroupValues.length > 0) {
      // looks like we have some values for a misc group
      const group: Node = {
        groups: new Map(),
        values: miscGroupValues,
        descendants: miscGroupValues.length,
      };
      node.groups.set(this.config.miscGroupKey, group);
    }
    return node;
  }
}

export interface Node {
  groups: Map<string, Node>;
  values: string[];
  descendants: number;
}

// PrefixDelimited extracts the prefix of a string at the given level.
function prefixDelimited(s: string, level: number): string {
  let delimiterCount = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    // Check if the character is not a letter or digit (non-alphanumeric)
    if (
      !(
        (
          (char >= 0x30 && char <= 0x39) || // 0-9
          (char >= 0x41 && char <= 0x5a) || // A-Z
          (char >= 0x61 && char <= 0x7a) || // a-z
          (char >= 0xc0 && char <= 0xd6) || // Latin-1 Supplement and Extended-A
          (char >= 0xd8 && char <= 0xf6) || // Latin-1 Supplement and Extended-A
          (char >= 0xf8 && char <= 0xff) || // Latin-1 Supplement and Extended-A
          (char >= 0x0100 && char <= 0x017f)
        ) // Latin Extended-A
      )
    ) {
      delimiterCount++;
      if (delimiterCount > level) {
        return s.slice(0, i);
      }
    }
  }
  return s; // Return the entire string if the level is higher than the number of delimiters.
}
