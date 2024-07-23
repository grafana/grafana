export { lookupNode, lookup, collectValues };

import { prefixDelimited } from './parser';

interface Node {
  groups: Map<string, Node>;
  values: string[];
  descendants: number;
}

// lookup finds the node matching the prefix.
// If no match is found, it returns null.
function lookupNode(node: Node, prefix: string): Node | null {
  return _lookupNode(node, 0, prefix);
}

// _lookupNode is the recursive implementation of lookup.
function _lookupNode(node: Node, level: number, prefix: string): Node | null {
  const thisPrefix = prefixDelimited(prefix, level);
  for (const [k, group] of node.groups.entries()) {
    if (k === prefix) {
      // perfect match
      return group;
    }
    if (k.startsWith(thisPrefix)) {
      return _lookupNode(group, level + 1, prefix);
    }
  }
  return null;
}

function lookup(node: Node, prefix: string): Node | null {
  const groups = new Map<string, Node>();
  const values: string[] = [];
  let descendants = 0;
  for (const [nodePrefix, group] of node.groups.entries()) {
    if (nodePrefix.startsWith(prefix)) {
      groups.set(nodePrefix, group);
      descendants += group.descendants;
      continue;
    }
    if (prefix.startsWith(nodePrefix)) {
      const subGroup = lookup(group, prefix);
      if (subGroup) {
        groups.set(nodePrefix, subGroup);
        descendants += subGroup.descendants;
      }
    }
  }
  for (const v of node.values) {
    if (v.startsWith(prefix)) {
      values.push(v);
      descendants += 1;
    }
  }
  if (groups.size === 0 && values.length === 0) {
    // nothing partially matching - so just return null
    return null;
  }
  return { groups, values, descendants };
}

// collectValues returns all values from the node and its descendants.
function collectValues(node: Node): string[] {
  const values: string[] = []; // Specify the type of the 'values' array
  function collectFrom(currentNode: Node): void {
    values.push(...currentNode.values);
    for (const groupNode of currentNode.groups.values()) {
      collectFrom(groupNode);
    }
  }

  collectFrom(node);
  return values;
}
