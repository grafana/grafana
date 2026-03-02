import type { CallExpression, JSXAttribute, JSXElement, Node, StringLiteral } from '@swc/core';
import type { ExtractedKeysMap, I18nextToolkitConfig, Plugin } from 'i18next-cli';

import {
  isCallExpression,
  isIdentifier,
  isJSXAttribute,
  isJSXElement,
  isJSXExpressionContainer,
  isJSXText,
  isKeyValueProperty,
  isObjectExpression,
  isStringLiteral,
} from './guards';
import { DuplicateKeyCheckOptions, Occurrence } from './types';

export function getStringValue(expr: StringLiteral | null | undefined): string | null {
  if (isStringLiteral(expr)) {
    return expr.value;
  }

  return null;
}

export function getCalleeName(callee: CallExpression['callee']): string | null {
  if (isIdentifier(callee)) {
    return callee.value;
  }

  return null;
}

export function extractKey(arg: { expression: Node } | null | undefined): string | null {
  if (isStringLiteral(arg?.expression)) {
    return arg.expression.value;
  }

  return null;
}

export function extractDefaultValue(arg: { expression: Node } | null | undefined): string | null {
  const expr = arg?.expression;

  if (isStringLiteral(expr)) {
    return expr.value;
  }

  if (isObjectExpression(expr)) {
    const prop = expr.properties.find(
      (p) => isKeyValueProperty(p) && (isIdentifier(p.key) || isStringLiteral(p.key)) && p.key.value === 'defaultValue'
    );

    if (!prop) {
      return null;
    }

    if (isKeyValueProperty(prop) && isStringLiteral(prop.value)) {
      return prop.value.value;
    }

    return null;
  }

  return null;
}

export function extractJSXTextContent(children: JSXElement['children']): string | null {
  const parts: string[] = [];
  for (const child of children) {
    if (isJSXText(child)) {
      const normalized = child.value.replace(/\s+/g, ' ');
      if (normalized.trim()) {
        parts.push(normalized);
      }
      continue;
    }

    if (isJSXExpressionContainer(child) && isStringLiteral(child.expression)) {
      parts.push(child.expression.value);
      continue;
    }
  }
  const combined = parts.join('').trim();
  return combined || null;
}

export function qualify(
  rawKey: string,
  nsSep: string | false | null | undefined,
  defNS: string | false | undefined
): string {
  const sep = nsSep === undefined || nsSep === null ? ':' : nsSep;
  const ns = defNS === undefined ? 'translation' : defNS;
  if (!sep || !ns) {
    return rawKey;
  }
  return rawKey.includes(sep) ? rawKey : `${ns}${sep}${rawKey}`;
}

export function shouldIgnore(qualifiedKey: string, ignoreKeys: string[]): boolean {
  return ignoreKeys.some((pattern) => {
    if (pattern.endsWith('*')) {
      return qualifiedKey.startsWith(pattern.slice(0, -1));
    }
    return qualifiedKey === pattern;
  });
}

export function formatConflictReport(conflicts: Array<{ key: string; occurrences: Occurrence[] }>): string {
  const lines: string[] = [
    `\n[duplicate-key-check] Found ${conflicts.length} key(s) with conflicting default values:\n`,
  ];

  for (const { key, occurrences } of conflicts) {
    lines.push(`  Key: "${key}"`);
    const byValue = new Map<string, string[]>();
    for (const occ of occurrences) {
      const files = byValue.get(occ.value) ?? [];
      files.push(occ.file);
      byValue.set(occ.value, files);
    }
    for (const [value, files] of byValue.entries()) {
      lines.push(`    Value: "${value}"`);
      for (const file of files) {
        lines.push(`      at ${file}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function duplicateKeyCheckPlugin(options: DuplicateKeyCheckOptions = {}): Plugin {
  const { failOnConflict = false, conflictThreshold = 2, ignoreKeys = [] } = options;

  let registry = new Map<string, Occurrence[]>();
  let currentFile = '';
  let nsSep: string | false | null = ':';
  let defNS: string | false = 'translation';
  let tFunctions = new Set<string>(['t']);
  let transComponents = new Set<string>(['Trans']);
  let configRead = false;

  function readConfig(config: I18nextToolkitConfig): void {
    if (configRead) {
      return;
    }
    configRead = true;
    nsSep = config.extract?.nsSeparator ?? ':';
    defNS = config.extract?.defaultNS ?? 'translation';
    transComponents = new Set(config.extract?.transComponents ?? ['Trans']);
    const fns = config.extract?.functions ?? ['t'];
    tFunctions = new Set(fns.filter((fn) => !fn.includes('.') && !fn.startsWith('*')));
  }

  function recordOccurrence(qualifiedKey: string, value: string): void {
    if (shouldIgnore(qualifiedKey, ignoreKeys)) {
      return;
    }
    const existing = registry.get(qualifiedKey) ?? [];
    existing.push({ value, file: currentFile });
    registry.set(qualifiedKey, existing);
  }

  return {
    name: 'duplicate-key-check',

    setup() {
      registry = new Map();
      currentFile = '';
      configRead = false;
    },

    onLoad(code: string, path: string): string {
      currentFile = path;
      return code;
    },

    onVisitNode(node: Node, context) {
      readConfig(context.config);

      if (isCallExpression(node)) {
        const calleeName = getCalleeName(node.callee);
        if (!calleeName || !tFunctions.has(calleeName)) {
          return;
        }

        const args = node.arguments;
        const rawKey = extractKey(args[0] ?? null);
        const defaultValue = extractDefaultValue(args[1] ?? null);
        if (!rawKey || !defaultValue) {
          return;
        }

        recordOccurrence(qualify(rawKey, nsSep, defNS), defaultValue);
        return;
      }

      if (isJSXElement(node)) {
        if (!isIdentifier(node.opening.name)) {
          return;
        }

        const componentName = node.opening.name.value;
        if (!transComponents.has(componentName)) {
          return;
        }

        const i18nKeyAttr = node.opening.attributes.find(
          (attr): attr is JSXAttribute =>
            isJSXAttribute(attr) && isIdentifier(attr.name) && attr.name.value === 'i18nKey'
        );

        if (!i18nKeyAttr?.value) {
          return;
        }

        if (!isStringLiteral(i18nKeyAttr.value)) {
          return;
        }

        const rawKey = i18nKeyAttr.value.value;
        const textContent = extractJSXTextContent(node.children);
        if (!textContent) {
          return;
        }

        recordOccurrence(qualify(rawKey, nsSep, defNS), textContent);
        return;
      }
    },

    async onEnd(_keys: ExtractedKeysMap) {
      const conflicts: Array<{ key: string; occurrences: Occurrence[] }> = [];

      for (const [qualifiedKey, occurrences] of registry.entries()) {
        const uniqueValues = new Set(occurrences.map((o) => o.value));
        if (uniqueValues.size >= conflictThreshold) {
          conflicts.push({ key: qualifiedKey, occurrences });
        }
      }

      registry = new Map();

      if (conflicts.length === 0) {
        return;
      }

      const report = formatConflictReport(conflicts);
      if (failOnConflict) {
        throw new Error(report);
      } else {
        console.warn(report);
      }
    },
  };
}
