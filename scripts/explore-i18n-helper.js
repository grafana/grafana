#!/usr/bin/env node
/**
 * Explore i18n Automation Helper
 *
 * A versatile CLI tool for finding, auditing, and transforming hardcoded UI strings
 * in Grafana Explore components (Issue #73984) into standard @grafana/i18n calls.
 *
 * Features:
 *   --check [path]    Scan TSX files for untranslated strings.
 *   --fix [path]      Automatically transform strings into <Trans> or t() calls.
 *   --dry-run         Preview fixes without modifying files on disk.
 *   --stats [path]    Output comprehensive i18n audit statistics across Explore.
 *   --help            Show CLI usage instructions.
 */

'use strict';

const glob = require('fast-glob');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const rootDir = path.resolve(__dirname, '..');
const defaultExploreDir = path.resolve(rootDir, 'public/app/features/explore');

// Set of JSX attribute names that represent user-facing UI text
const UI_PROPS = new Set([
  'title',
  'label',
  'aria-label',
  'ariaLabel',
  'placeholder',
  'tooltip',
  'description',
  'confirmText',
  'text',
  'body',
  'loadingMessage',
  'noOptionsMessage',
  'emptyText',
  'subTitle',
  'placeholderText',
  'message',
  'closeIconTooltip',
  'formattedDataDescription',
  'buttonText',
  'header',
  'footer',
  'content',
]);

// Set of variable names that represent UI text
const UI_VAR_NAMES = new Set([
  'tooltip',
  'label',
  'title',
  'description',
  'message',
  'placeholder',
  'confirmtext',
  'text',
  'emptytext',
  'header',
  'footer',
  'errormessage',
]);

// Non-UI attributes to explicitly ignore
const IGNORED_PROPS = new Set([
  'id',
  'key',
  'className',
  'style',
  'type',
  'variant',
  'size',
  'placement',
  'icon',
  'data-testid',
  'role',
  'target',
  'rel',
  'width',
  'height',
  'name',
  'fill',
  'stroke',
  'method',
  'action',
  'tabIndex',
  'autoComplete',
  'color',
  'href',
  'src',
]);

/**
 * Converts a string to kebab-case
 * @param {string} str
 * @returns {string}
 */
function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_\.]+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Derives a component key segment from file path
 * @param {string} filePath
 * @returns {string}
 */
function getComponentSegment(filePath) {
  const baseName = path.basename(filePath, path.extname(filePath));
  return toKebabCase(baseName) || 'explore-component';
}

/**
 * Generates a strictly 3-segment i18n key: explore.<component>.<descriptor>
 * @param {string} componentName
 * @param {string} text
 * @param {string} [contextName]
 * @returns {string}
 */
function generateI18nKey(componentName, text, contextName) {
  const compKebab = toKebabCase(componentName);

  let prefix = '';
  if (contextName && contextName !== 'children' && !['true', 'false'].includes(contextName)) {
    prefix = toKebabCase(contextName);
  }

  const prefixWords = prefix ? prefix.split('-').filter(Boolean) : [];

  // Clean words from text
  const cleanText = text.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const rawWords = cleanText
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());

  let descriptor = '';

  if (prefixWords.length >= 3) {
    // If the prop/variable name is already very descriptive (3+ words, e.g. formatted-data-description, close-icon-tooltip)
    descriptor = prefix;
  } else {
    // Filter out words already present in prefix
    const uniqueWords = rawWords.filter(
      (w) => !prefixWords.includes(w) && !['the', 'to', 'in', 'of', 'for', 'a', 'an', 'and'].includes(w)
    );
    const wordsToTake = uniqueWords.length > 0 ? uniqueWords.slice(0, 3) : rawWords.slice(0, 2);
    const wordsKebab = wordsToTake.join('-');

    if (prefix && wordsKebab) {
      descriptor = `${prefix}-${wordsKebab}`;
    } else if (wordsKebab) {
      descriptor = wordsKebab;
    } else if (prefix) {
      descriptor = prefix;
    } else {
      descriptor = 'message';
    }
  }

  // Fallback if empty
  if (!descriptor) {
    descriptor = 'message';
  }

  // Ensure descriptor has no dots and is kebab-case
  descriptor = toKebabCase(descriptor);

  return `explore.${compKebab}.${descriptor}`;
}

/**
 * Validates whether an i18n key adheres to Grafana Explore 3-segment convention
 * @param {string} key
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateKeyFormat(key) {
  if (!key || typeof key !== 'string') {
    return { valid: false, reason: 'Key is empty or not a string' };
  }
  const segments = key.split('.');
  if (segments[0] !== 'explore') {
    return { valid: false, reason: `Invalid namespace: expected "explore", got "${segments[0]}"` };
  }
  if (segments.length !== 3) {
    return { valid: false, reason: `Key must have exactly 3 segments, got ${segments.length}` };
  }
  const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  for (const seg of segments) {
    if (!kebabRegex.test(seg)) {
      return { valid: false, reason: `Segment "${seg}" is not lowercase kebab-case` };
    }
  }
  return { valid: true };
}

/**
 * Checks if an AST node is inside a <Trans> JSX element
 * @param {ts.Node} node
 * @returns {boolean}
 */
function isInsideTrans(node) {
  let curr = node.parent;
  while (curr) {
    if (ts.isJsxElement(curr)) {
      const tag = curr.openingElement.tagName;
      if (ts.isIdentifier(tag) && tag.text === 'Trans') {
        return true;
      }
    }
    if (ts.isJsxSelfClosingElement(curr)) {
      const tag = curr.tagName;
      if (ts.isIdentifier(tag) && tag.text === 'Trans') {
        return true;
      }
    }
    curr = curr.parent;
  }
  return false;
}

/**
 * Checks if an AST node is inside a t(...) call
 * @param {ts.Node} node
 * @returns {boolean}
 */
function isInsideTCall(node) {
  let curr = node.parent;
  while (curr) {
    if (ts.isCallExpression(curr)) {
      const expr = curr.expression;
      if (ts.isIdentifier(expr) && expr.text === 't') {
        return true;
      }
    }
    curr = curr.parent;
  }
  return false;
}

/**
 * Checks if an AST node is inside css(...) or styling utilities
 * @param {ts.Node} node
 * @returns {boolean}
 */
function isInsideCss(node) {
  let curr = node.parent;
  while (curr) {
    if (ts.isCallExpression(curr)) {
      const expr = curr.expression;
      if (ts.isIdentifier(expr) && (expr.text === 'css' || expr.text === 'useStyles2')) {
        return true;
      }
    }
    if (ts.isTaggedTemplateExpression(curr)) {
      const tag = curr.tag;
      if (ts.isIdentifier(tag) && tag.text === 'css') {
        return true;
      }
    }
    curr = curr.parent;
  }
  return false;
}

/**
 * Checks if an AST node is inside <code> or <pre> tags
 * @param {ts.Node} node
 * @returns {boolean}
 */
function isInsideCodeOrPre(node) {
  let curr = node.parent;
  while (curr) {
    if (ts.isJsxElement(curr)) {
      const tag = curr.openingElement.tagName;
      if (ts.isIdentifier(tag) && (tag.text === 'code' || tag.text === 'pre')) {
        return true;
      }
    }
    curr = curr.parent;
  }
  return false;
}

/**
 * Checks if an AST node is inside an ignored call (console, reportInteraction, etc.)
 * @param {ts.Node} node
 * @returns {boolean}
 */
function isInsideIgnoredCall(node) {
  let curr = node.parent;
  while (curr) {
    if (ts.isCallExpression(curr)) {
      const expr = curr.expression;
      if (ts.isIdentifier(expr) && (expr.text === 'reportInteraction' || expr.text === 'useSelector')) {
        return true;
      }
      if (ts.isPropertyAccessExpression(expr)) {
        if (ts.isIdentifier(expr.expression) && ['console', 'selectors', 'history'].includes(expr.expression.text)) {
          return true;
        }
      }
    }
    curr = curr.parent;
  }
  return false;
}

/**
 * Determines if a string is user-facing UI text needing translation
 * @param {string} str
 * @returns {boolean}
 */
function isTranslatableString(str) {
  if (!str || typeof str !== 'string') {
    return false;
  }
  const trimmed = str.trim();
  if (!trimmed) {
    return false;
  }
  // Must contain at least one alphabetic character
  if (!/[a-zA-Z]/.test(trimmed)) {
    return false;
  }
  // Ignore strings containing JSX special characters, HTML tags, or interpolation braces ({}, <>, |)
  if (/[{}<>|]/.test(trimmed)) {
    return false;
  }
  // Ignore strings containing HTML entities (e.g. &quot;, &amp;, &#39;)
  if (/&[a-zA-Z0-9#]+;/.test(trimmed)) {
    return false;
  }
  // Ignore URLs, hex colors, mime types, file paths
  if (/^(https?:\/\/|\/|#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$|application\/|[a-zA-Z0-9_\-]+\.[a-z]{2,4}$)/.test(trimmed)) {
    return false;
  }
  // Ignore redux action types (e.g. explore/...)
  if (/^explore\/[a-zA-Z0-9_\-]+$/.test(trimmed)) {
    return false;
  }
  // Ignore single words that are pure numbers or code identifiers with underscores/dots only
  if (/^[A-Z0-9_]+$/.test(trimmed) && trimmed.length < 4) {
    return false;
  }
  return true;
}

/**
 * Scans a single TSX file for untranslated strings and extracted keys
 * @param {string} filePath
 * @param {string} code
 * @returns {{
 *   untranslated: Array<{
 *     file: string,
 *     line: number,
 *     col: number,
 *     type: 'jsx-text' | 'jsx-attribute' | 'ui-literal',
 *     prop?: string,
 *     text: string,
 *     suggestedKey: string,
 *     nodeStart: number,
 *     nodeEnd: number,
 *     replacement?: string
 *   }>,
 *   translatedKeys: Array<{ key: string, type: 't' | 'Trans', line: number }>
 * }}
 */
function scanFile(filePath, code) {
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const componentSegment = getComponentSegment(filePath);

  const untranslated = [];
  const translatedKeys = [];

  function visit(node) {
    // 1. Record existing translated keys
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 't') {
        const arg0 = node.arguments[0];
        if (arg0 && ts.isStringLiteral(arg0)) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          translatedKeys.push({ key: arg0.text, type: 't', line: pos.line + 1 });
        }
      }
    }

    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
      if (ts.isIdentifier(tag) && tag.text === 'Trans') {
        const attrs = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
        for (const prop of attrs.properties) {
          if (ts.isJsxAttribute(prop) && prop.name.text === 'i18nKey') {
            if (prop.initializer && ts.isStringLiteral(prop.initializer)) {
              const pos = sourceFile.getLineAndCharacterOfPosition(prop.getStart(sourceFile));
              translatedKeys.push({ key: prop.initializer.text, type: 'Trans', line: pos.line + 1 });
            }
          }
        }
      }
    }

    // 2. Detect untranslated JSX Text
    if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (isTranslatableString(text) && !isInsideTrans(node) && !isInsideCss(node) && !isInsideCodeOrPre(node)) {
        const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const suggestedKey = generateI18nKey(componentSegment, text, 'message');
        untranslated.push({
          file: relPath,
          line: pos.line + 1,
          col: pos.character + 1,
          type: 'jsx-text',
          text,
          suggestedKey,
          nodeStart: node.getStart(sourceFile),
          nodeEnd: node.getEnd(),
          replacement: `<Trans i18nKey="${suggestedKey}">${text}</Trans>`,
        });
      }
    }

    // 2.5 Detect untranslated JsxExpression children
    if (ts.isJsxExpression(node) && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      if (
        node.expression &&
        (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression))
      ) {
        const text = node.expression.text.trim();
        if (isTranslatableString(text) && !isInsideTrans(node) && !isInsideCss(node) && !isInsideCodeOrPre(node)) {
          const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          const suggestedKey = generateI18nKey(componentSegment, text, 'message');
          untranslated.push({
            file: relPath,
            line: pos.line + 1,
            col: pos.character + 1,
            type: 'jsx-text',
            text,
            suggestedKey,
            nodeStart: node.getStart(sourceFile),
            nodeEnd: node.getEnd(),
            replacement: `<Trans i18nKey="${suggestedKey}">${text}</Trans>`,
          });
        }
      }
    }

    // 3. Detect untranslated JSX Attributes
    if (ts.isJsxAttribute(node)) {
      const propName = node.name.text;
      if (UI_PROPS.has(propName) && !IGNORED_PROPS.has(propName) && node.initializer) {
        // String literal initializer: prop="text"
        if (ts.isStringLiteral(node.initializer)) {
          const val = node.initializer.text;
          if (isTranslatableString(val) && !isInsideTCall(node.initializer)) {
            const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            const suggestedKey = generateI18nKey(componentSegment, val, propName);
            const escaped = val.replace(/'/g, "\\'");
            untranslated.push({
              file: relPath,
              line: pos.line + 1,
              col: pos.character + 1,
              type: 'jsx-attribute',
              prop: propName,
              text: val,
              suggestedKey,
              nodeStart: node.getStart(sourceFile),
              nodeEnd: node.getEnd(),
              replacement: `${propName}={t('${suggestedKey}', '${escaped}')}`,
            });
          }
        }

        // Expression initializer: prop={'text'} or prop={cond ? 'a' : 'b'}
        if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
          const expr = node.initializer.expression;
          if (ts.isStringLiteral(expr)) {
            const val = expr.text;
            if (isTranslatableString(val) && !isInsideTCall(expr)) {
              const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
              const suggestedKey = generateI18nKey(componentSegment, val, propName);
              const escaped = val.replace(/'/g, "\\'");
              untranslated.push({
                file: relPath,
                line: pos.line + 1,
                col: pos.character + 1,
                type: 'jsx-attribute',
                prop: propName,
                text: val,
                suggestedKey,
                nodeStart: node.getStart(sourceFile),
                nodeEnd: node.getEnd(),
                replacement: `${propName}={t('${suggestedKey}', '${escaped}')}`,
              });
            }
          }

          if (ts.isConditionalExpression(expr)) {
            if (
              ts.isStringLiteral(expr.whenTrue) &&
              isTranslatableString(expr.whenTrue.text) &&
              !isInsideTCall(expr.whenTrue)
            ) {
              const pos = sourceFile.getLineAndCharacterOfPosition(expr.whenTrue.getStart(sourceFile));
              const text = expr.whenTrue.text;
              const suggestedKey = generateI18nKey(componentSegment, text, propName);
              const escaped = text.replace(/'/g, "\\'");
              untranslated.push({
                file: relPath,
                line: pos.line + 1,
                col: pos.character + 1,
                type: 'jsx-attribute',
                prop: propName,
                text,
                suggestedKey,
                nodeStart: expr.whenTrue.getStart(sourceFile),
                nodeEnd: expr.whenTrue.getEnd(),
                replacement: `t('${suggestedKey}', '${escaped}')`,
              });
            }
            if (
              ts.isStringLiteral(expr.whenFalse) &&
              isTranslatableString(expr.whenFalse.text) &&
              !isInsideTCall(expr.whenFalse)
            ) {
              const pos = sourceFile.getLineAndCharacterOfPosition(expr.whenFalse.getStart(sourceFile));
              const text = expr.whenFalse.text;
              const suggestedKey = generateI18nKey(componentSegment, text, propName);
              const escaped = text.replace(/'/g, "\\'");
              untranslated.push({
                file: relPath,
                line: pos.line + 1,
                col: pos.character + 1,
                type: 'jsx-attribute',
                prop: propName,
                text,
                suggestedKey,
                nodeStart: expr.whenFalse.getStart(sourceFile),
                nodeEnd: expr.whenFalse.getEnd(),
                replacement: `t('${suggestedKey}', '${escaped}')`,
              });
            }
          }
        }
      }
    }

    // 4. Detect untranslated strings in UI variable assignments (e.g. const tooltip = cond ? 'a' : 'b')
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const varNameLower = node.name.text.toLowerCase();
      if (UI_VAR_NAMES.has(varNameLower) && node.initializer && !isInsideCss(node) && !isInsideIgnoredCall(node)) {
        if (ts.isConditionalExpression(node.initializer)) {
          const cond = node.initializer;
          if (
            ts.isStringLiteral(cond.whenTrue) &&
            isTranslatableString(cond.whenTrue.text) &&
            !isInsideTCall(cond.whenTrue)
          ) {
            const pos = sourceFile.getLineAndCharacterOfPosition(cond.whenTrue.getStart(sourceFile));
            const text = cond.whenTrue.text;
            const suggestedKey = generateI18nKey(componentSegment, text, node.name.text);
            const escaped = text.replace(/'/g, "\\'");
            untranslated.push({
              file: relPath,
              line: pos.line + 1,
              col: pos.character + 1,
              type: 'ui-literal',
              prop: node.name.text,
              text,
              suggestedKey,
              nodeStart: cond.whenTrue.getStart(sourceFile),
              nodeEnd: cond.whenTrue.getEnd(),
              replacement: `t('${suggestedKey}', '${escaped}')`,
            });
          }
          if (
            ts.isStringLiteral(cond.whenFalse) &&
            isTranslatableString(cond.whenFalse.text) &&
            !isInsideTCall(cond.whenFalse)
          ) {
            const pos = sourceFile.getLineAndCharacterOfPosition(cond.whenFalse.getStart(sourceFile));
            const text = cond.whenFalse.text;
            const suggestedKey = generateI18nKey(componentSegment, text, node.name.text);
            const escaped = text.replace(/'/g, "\\'");
            untranslated.push({
              file: relPath,
              line: pos.line + 1,
              col: pos.character + 1,
              type: 'ui-literal',
              prop: node.name.text,
              text,
              suggestedKey,
              nodeStart: cond.whenFalse.getStart(sourceFile),
              nodeEnd: cond.whenFalse.getEnd(),
              replacement: `t('${suggestedKey}', '${escaped}')`,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { untranslated, translatedKeys };
}

/**
 * Updates imports in a code string to ensure required @grafana/i18n identifiers are present
 * @param {string} code
 * @param {boolean} needsTrans
 * @param {boolean} needsT
 * @returns {string}
 */
function updateImports(code, needsTrans, needsT) {
  if (!needsTrans && !needsT) {
    return code;
  }

  const i18nImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]@grafana\/i18n['"];?/;
  const match = code.match(i18nImportRegex);

  if (match) {
    const existing = match[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    let changed = false;
    if (needsTrans && !existing.includes('Trans')) {
      existing.push('Trans');
      changed = true;
    }
    if (needsT && !existing.includes('t')) {
      existing.push('t');
      changed = true;
    }
    if (changed) {
      existing.sort();
      const newImport = `import { ${existing.join(', ')} } from '@grafana/i18n';`;
      return code.replace(match[0], newImport);
    }
    return code;
  }

  const toAdd = [];
  if (needsTrans) {
    toAdd.push('Trans');
  }
  if (needsT) {
    toAdd.push('t');
  }
  toAdd.sort();
  const importStmt = `import { ${toAdd.join(', ')} } from '@grafana/i18n';\n`;

  // Place after existing imports or at the top
  const firstImportMatch = code.match(/import\s/);
  if (firstImportMatch && firstImportMatch.index !== undefined) {
    return code.slice(0, firstImportMatch.index) + importStmt + code.slice(firstImportMatch.index);
  }

  return importStmt + code;
}

/**
 * Resolves file paths to audit or fix
 * @param {string} [targetPath]
 * @returns {string[]}
 */
function resolveFiles(targetPath) {
  if (!targetPath) {
    return glob.sync('*.tsx', {
      cwd: defaultExploreDir,
      absolute: true,
      ignore: ['**/*.test.{ts,tsx}', '**/spec/**', '**/mocks/**', '**/__mocks__/**'],
    });
  }

  const resolved = path.resolve(process.cwd(), targetPath);
  if (!fs.existsSync(resolved)) {
    console.error(`[ERROR] Specified path does not exist: ${resolved}`);
    process.exit(1);
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    return [resolved];
  }

  return glob.sync('**/*.tsx', {
    cwd: resolved,
    absolute: true,
    ignore: ['**/*.test.{ts,tsx}', '**/spec/**', '**/mocks/**', '**/__mocks__/**'],
  });
}

/**
 * Command: --check
 * Scans TSX files and lists hardcoded strings requiring translation.
 * @param {string} [targetPath]
 * @param {boolean} [verbose]
 * @returns {number} Exit code
 */
function runCheck(targetPath, verbose) {
  const files = resolveFiles(targetPath);
  console.log(`[CHECK] Scanning ${files.length} TSX file(s) for untranslated strings...\n`);

  let totalViolations = 0;
  const filesWithViolations = [];

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const { untranslated } = scanFile(file, code);

    if (untranslated.length > 0) {
      totalViolations += untranslated.length;
      filesWithViolations.push({ file, untranslated });

      console.log(
        `\n  ✗ ${path.relative(rootDir, file).replace(/\\/g, '/')}: ${untranslated.length} untranslated string(s)`
      );
      for (const item of untranslated) {
        console.log(`    - Line ${item.line}:${item.col} [${item.type}] "${item.text}"`);
        console.log(`      Suggested Key: ${item.suggestedKey}`);
      }
    } else if (verbose) {
      console.log(`  ✓ ${path.relative(rootDir, file).replace(/\\/g, '/')}: Clean (0 untranslated strings)`);
    }
  }

  console.log('\n------------------------------------------------------------');
  if (totalViolations === 0) {
    console.log('✓ All audited files are clean! No untranslated strings detected.');
    return 0;
  } else {
    console.log(`✗ Found ${totalViolations} untranslated string(s) across ${filesWithViolations.length} file(s).`);
    console.log('  Run with --fix to apply transformations automatically, or --dry-run to preview.');
    return 1;
  }
}

/**
 * Command: --fix
 * Automatically applies transformations for simple JSX text (<Trans>) and attributes (t()).
 * @param {string} [targetPath]
 * @param {boolean} [isDryRun]
 * @returns {number} Exit code
 */
function runFix(targetPath, isDryRun) {
  const files = resolveFiles(targetPath);
  const modeLabel = isDryRun ? '[DRY-RUN]' : '[FIX]';
  console.log(`${modeLabel} Processing ${files.length} file(s)...\n`);

  let modifiedFilesCount = 0;
  let totalFixesApplied = 0;

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const { untranslated } = scanFile(file, code);

    const fixableItems = untranslated.filter((item) => item.replacement);
    if (fixableItems.length === 0) {
      continue;
    }

    // Sort fixes in descending order of position to prevent offset drift
    fixableItems.sort((a, b) => b.nodeStart - a.nodeStart);

    let updatedCode = code;
    let needsTrans = false;
    let needsT = false;

    for (const item of fixableItems) {
      if (item.type === 'jsx-text') {
        needsTrans = true;
      } else {
        needsT = true;
      }
      updatedCode = updatedCode.slice(0, item.nodeStart) + item.replacement + updatedCode.slice(item.nodeEnd);
    }

    updatedCode = updateImports(updatedCode, needsTrans, needsT);

    modifiedFilesCount++;
    totalFixesApplied += fixableItems.length;

    const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
    if (isDryRun) {
      console.log(`  Preview for ${relPath}: ${fixableItems.length} transformation(s)`);
      for (const item of fixableItems) {
        console.log(`    Line ${item.line}: "${item.text}" -> ${item.replacement}`);
      }
    } else {
      fs.writeFileSync(file, updatedCode, 'utf8');
      console.log(`  ✓ Transformed ${relPath}: ${fixableItems.length} string(s) fixed`);
    }
  }

  console.log('\n------------------------------------------------------------');
  if (modifiedFilesCount === 0) {
    console.log(`${modeLabel} No files required fixing.`);
  } else {
    const actionLabel = isDryRun ? 'Previewed' : 'Applied';
    console.log(
      `${modeLabel} ${actionLabel} ${totalFixesApplied} transformation(s) across ${modifiedFilesCount} file(s).`
    );
  }
  return 0;
}

/**
 * Command: --stats
 * Outputs an audit summary of translated vs untranslated components across Explore.
 * @param {string} [targetPath]
 * @returns {number} Exit code
 */
function runStats(targetPath) {
  const files = resolveFiles(targetPath);
  console.log('============================================================');
  console.log('   Grafana Explore i18n Automation & Audit Statistics');
  console.log('============================================================\n');

  let fullyTranslatedCount = 0;
  let partiallyTranslatedCount = 0;
  let untranslatedCount = 0;
  let pureLogicCount = 0;
  let totalTranslatedKeys = 0;
  let totalUntranslatedStrings = 0;

  const milestoneAudit = {
    m1: [
      { name: 'NoData.tsx', rel: 'public/app/features/explore/NoData.tsx' },
      { name: 'ErrorContainer.tsx', rel: 'public/app/features/explore/ErrorContainer.tsx' },
      { name: 'ResponseErrorContainer.tsx', rel: 'public/app/features/explore/ResponseErrorContainer.tsx' },
      { name: 'NoDataSourceCallToAction.tsx', rel: 'public/app/features/explore/NoDataSourceCallToAction.tsx' },
    ],
    m3: [
      { name: 'TimeSyncButton.tsx', rel: 'public/app/features/explore/TimeSyncButton.tsx' },
      { name: 'ExploreRunQueryButton.tsx', rel: 'public/app/features/explore/ExploreRunQueryButton.tsx' },
      { name: 'ExploreQueryInspector.tsx', rel: 'public/app/features/explore/ExploreQueryInspector.tsx' },
      { name: 'ExploreGraphLabel.tsx', rel: 'public/app/features/explore/Graph/ExploreGraphLabel.tsx' },
    ],
  };

  const fileStatsMap = new Map();

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const { untranslated, translatedKeys } = scanFile(file, code);

    const transCount = translatedKeys.length;
    const untransCount = untranslated.length;

    totalTranslatedKeys += transCount;
    totalUntranslatedStrings += untransCount;

    let category = 'pure-logic';
    if (transCount > 0 && untransCount === 0) {
      category = 'fully-translated';
      fullyTranslatedCount++;
    } else if (transCount > 0 && untransCount > 0) {
      category = 'partially-translated';
      partiallyTranslatedCount++;
    } else if (transCount === 0 && untransCount > 0) {
      category = 'untranslated';
      untranslatedCount++;
    } else {
      category = 'pure-logic';
      pureLogicCount++;
    }

    const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
    fileStatsMap.set(relPath, { transCount, untransCount, category });
  }

  const totalFiles = files.length;
  const pct = (val) => (totalFiles > 0 ? ((val / totalFiles) * 100).toFixed(1) : '0.0');
  const totalStrings = totalTranslatedKeys + totalUntranslatedStrings;
  const healthScore = totalStrings > 0 ? ((totalTranslatedKeys / totalStrings) * 100).toFixed(1) : '100.0';

  console.log('[Summary Metrics]');
  console.log(`  Total Explore TSX Components:      ${totalFiles}`);
  console.log(`  Fully Internationalized Files:     ${fullyTranslatedCount} (${pct(fullyTranslatedCount)}%)`);
  console.log(`  Partially Internationalized Files: ${partiallyTranslatedCount} (${pct(partiallyTranslatedCount)}%)`);
  console.log(`  Untranslated Component Files:      ${untranslatedCount} (${pct(untranslatedCount)}%)`);
  console.log(`  Pure Logic / Wrapper Files:        ${pureLogicCount} (${pct(pureLogicCount)}%)`);
  console.log('');
  console.log(`  Total Translated Keys:             ${totalTranslatedKeys}`);
  console.log(`  Total Untranslated Strings:        ${totalUntranslatedStrings}`);
  console.log(`  Overall Translation Health Score:  ${healthScore}%`);

  console.log('\n[Milestone 1 Components: Proof-of-Concept]');
  for (const item of milestoneAudit.m1) {
    const stats = fileStatsMap.get(item.rel);
    if (stats) {
      const statusIcon = stats.untransCount === 0 ? '✓' : '✗';
      console.log(
        `  ${statusIcon} ${item.name.padEnd(28)} - ${stats.transCount} key(s), ${stats.untransCount} untranslated [${stats.category}]`
      );
    } else {
      console.log(`  ? ${item.name.padEnd(28)} - (File not in scanned set)`);
    }
  }

  console.log('\n[Milestone 3 Components: Secondary Batch Candidates]');
  for (const item of milestoneAudit.m3) {
    const stats = fileStatsMap.get(item.rel);
    if (stats) {
      const statusIcon = stats.untransCount > 0 ? '⚠' : '✓';
      console.log(
        `  ${statusIcon} ${item.name.padEnd(28)} - ${stats.transCount} key(s), ${stats.untransCount} untranslated [${stats.category}]`
      );
    } else {
      console.log(`  ? ${item.name.padEnd(28)} - (File not in scanned set)`);
    }
  }

  console.log('\n============================================================');
  return 0;
}

/**
 * Prints help output
 */
function printHelp() {
  console.log(`
Usage: node scripts/explore-i18n-helper.js [options] [path]

A versatile automation tool for internationalizing Grafana Explore components (Issue #73984).

Commands & Modes:
  --check, -c [path]   Scan TSX files and report hardcoded strings requiring translation.
                       Exits with code 0 if all clean, code 1 if untranslated strings found.
  --fix, -f [path]     Automatically transform hardcoded JSX text (<Trans>) and attributes (t()).
                       Strictly enforces 3-segment kebab-case: explore.<component>.<descriptor>.
  --dry-run, -d        Preview transformations without modifying files on disk (use with --fix).
  --stats, -s [path]   Display comprehensive i18n audit metrics across Explore components.
  --help, -h           Show this help message and exit.
  --verbose, -v        Enable verbose output during scanning.

Key Convention:
  Format: explore.<component-kebab>.<descriptor-kebab>
  Rule:   Strictly 3 segments, static string literals only.

Examples:
  node scripts/explore-i18n-helper.js --help
  node scripts/explore-i18n-helper.js --check public/app/features/explore/NoData.tsx
  node scripts/explore-i18n-helper.js --check public/app/features/explore/TimeSyncButton.tsx
  node scripts/explore-i18n-helper.js --fix --dry-run public/app/features/explore/TimeSyncButton.tsx
  node scripts/explore-i18n-helper.js --stats
`);
}

/**
 * CLI Entry Point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  const isVerbose = args.includes('--verbose') || args.includes('-v');

  // Extract non-flag arguments
  const nonFlagArgs = args.filter((arg) => !arg.startsWith('-'));
  const targetPath = nonFlagArgs[0];

  if (args.includes('--stats') || args.includes('-s')) {
    const code = runStats(targetPath);
    process.exit(code);
  }

  if (
    args.includes('--fix') ||
    args.includes('-f') ||
    (isDryRun && !args.includes('--check') && !args.includes('-c'))
  ) {
    const code = runFix(targetPath, isDryRun);
    process.exit(code);
  }

  if (args.includes('--check') || args.includes('-c')) {
    const code = runCheck(targetPath, isVerbose);
    process.exit(code);
  }

  // If a path was provided without explicit mode, default to --check
  if (targetPath) {
    const code = runCheck(targetPath, isVerbose);
    process.exit(code);
  }

  printHelp();
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  toKebabCase,
  getComponentSegment,
  generateI18nKey,
  validateKeyFormat,
  isTranslatableString,
  scanFile,
  updateImports,
  runCheck,
  runFix,
  runStats,
};
