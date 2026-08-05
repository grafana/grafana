import { valid } from 'semver';

// Serializes the versioned selector tree into a data-only form so it can be served as JSON and
// consumed without executing code. Function selectors become positional template descriptors that
// @grafana/plugin-e2e reconstructs into functions locally. See design doc: Plugin E2E Selectors.

// private-use characters, unlikely to appear in any selector, used to locate argument positions
const ARG_SENTINELS = [0xe000, 0xe001, 0xe002, 0xe003].map((code) => String.fromCharCode(code));

type SelectorValue = string | ((...args: string[]) => string);
type VersionedSelector = Record<string, SelectorValue>;
type SelectorGroup = { [key: string]: VersionedSelector | SelectorGroup };

type TemplateDescriptor = {
  $template: string | { whenPresent: string; whenAbsent: string };
  params: string[];
};
type SerializedValue = string | TemplateDescriptor;
type SerializedVersioned = Record<string, SerializedValue>;
export type SerializedGroup = { [key: string]: SerializedVersioned | SerializedGroup };

// a node is a versioned selector leaf (rather than a nested group) when its first key is a semver
// version. this mirrors how resolveSelectors distinguishes the two.
function isVersionedLeaf(node: VersionedSelector | SelectorGroup): node is VersionedSelector {
  const firstKey = Object.keys(node)[0];
  return firstKey !== undefined && valid(firstKey) !== null;
}

// reads parameter names from the (transpiled) function source, e.g. "(from, to) => ..." -> [from, to]
function parseParamNames(fn: (...args: string[]) => string): string[] {
  const src = fn.toString();
  const open = src.indexOf('(');
  const close = src.indexOf(')', open);
  const inner = src.slice(open + 1, close).trim();
  if (!inner) {
    return [];
  }
  return inner
    .split(',')
    .map((param) => param.split('=')[0].trim())
    .filter(Boolean);
}

function serializeFunction(fn: (...args: string[]) => string): TemplateDescriptor {
  const params = parseParamNames(fn);

  if (params.length === 0) {
    return { $template: fn(), params: [] };
  }

  const sentinels = params.map((_, index) => ARG_SENTINELS[index]);
  const present = fn(...sentinels);
  let template = present;
  sentinels.forEach((sentinel, index) => {
    template = template.split(sentinel).join(`{${index}}`);
  });

  // detect a conditional single-arg selector: `(x) => x ? withArg : withoutArg`. when called with an
  // empty string the ternary drops a whole segment, so the empty-arg output differs from simply
  // substituting the argument with an empty string.
  if (params.length === 1) {
    const absent = fn('');
    const presentWithEmptyArg = present.split(sentinels[0]).join('');
    if (absent !== presentWithEmptyArg) {
      return { $template: { whenPresent: template, whenAbsent: absent }, params };
    }
  }

  return { $template: template, params };
}

function serializeValue(value: SelectorValue): SerializedValue {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'function') {
    return serializeFunction(value);
  }
  throw new Error(`Unsupported selector value of type "${typeof value}"`);
}

function serializeVersioned(leaf: VersionedSelector): SerializedVersioned {
  const result: SerializedVersioned = {};
  for (const [version, value] of Object.entries(leaf)) {
    result[version] = serializeValue(value);
  }
  return result;
}

export function serializeSelectorGroup(group: SelectorGroup): SerializedGroup {
  const result: SerializedGroup = {};
  for (const [key, node] of Object.entries(group)) {
    if (isVersionedLeaf(node)) {
      result[key] = serializeVersioned(node);
    } else {
      result[key] = serializeSelectorGroup(node);
    }
  }
  return result;
}
