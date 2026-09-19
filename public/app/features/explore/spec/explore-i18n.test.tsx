import { render, screen } from '@testing-library/react';
import glob from 'fast-glob';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import { t, Trans } from '@grafana/i18n';

import { ErrorContainer } from '../ErrorContainer';
import { NoData } from '../NoData';

// --- Helper Functions for Static Analysis & Verification ---

export interface KeyValidationResult {
  valid: boolean;
  segments: string[];
  reason?: string;
}

/**
 * Validates that an i18n key adheres to the Grafana Explore convention:
 * - Must start with the `explore` namespace prefix.
 * - Maximum of 3 dot-separated segments (`explore.<component-kebab>.<descriptor-kebab>`).
 * - Each segment must be lowercase alphanumeric with hyphens (kebab-case).
 * - Must not be empty or dynamic.
 */
export function validateI18nKey(key: string): KeyValidationResult {
  if (!key || typeof key !== 'string') {
    return { valid: false, segments: [], reason: 'Key must be a non-empty string literal' };
  }

  const segments = key.split('.');

  if (segments[0] !== 'explore') {
    return { valid: false, segments, reason: `Key must start with "explore." prefix, found: "${segments[0]}"` };
  }

  if (segments.length < 2) {
    return { valid: false, segments, reason: 'Key must contain at least 2 segments (feature.component)' };
  }

  if (segments.length > 3) {
    return {
      valid: false,
      segments,
      reason: `Key exceeds maximum of 3 segments: found ${segments.length} segments in "${key}"`,
    };
  }

  const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!kebabRegex.test(seg)) {
      return {
        valid: false,
        segments,
        reason: `Segment "${seg}" (index ${i}) does not conform to lowercase kebab-case`,
      };
    }
  }

  return { valid: true, segments };
}

/**
 * Inspects a TypeScript / TSX source string for forbidden direct imports
 * from `react-i18next` or `i18next`.
 */
export function checkForbiddenImports(code: string, fileName = 'file.tsx'): string[] {
  const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        const moduleName = node.moduleSpecifier.text;
        if (moduleName === 'react-i18next' || moduleName === 'i18next') {
          violations.push(moduleName);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

/**
 * Inspects a TypeScript / TSX source string for top-level module scope calls to `t()`.
 * Any call to `t()` must be enclosed inside a function, component, or method.
 */
export function checkTopLevelTCalls(code: string, fileName = 'file.tsx'): string[] {
  const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
  const topLevelCalls: string[] = [];

  function visit(node: ts.Node, inFunctionScope: boolean) {
    const isFunctionScope =
      inFunctionScope ||
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessor(node) ||
      ts.isSetAccessor(node);

    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 't') {
        if (!isFunctionScope) {
          topLevelCalls.push(node.getText(sourceFile));
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, isFunctionScope));
  }

  visit(sourceFile, false);
  return topLevelCalls;
}

/**
 * Extracts static i18n keys and default English messages from Explore source code.
 */
export function extractStaticKeys(code: string, fileName = 'file.tsx') {
  const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
  const extracted: Array<{
    type: 't' | 'Trans';
    key: string;
    defaultMessage?: string;
    isDynamic: boolean;
  }> = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 't') {
        const arg0 = node.arguments[0];
        const arg1 = node.arguments[1];

        if (arg0 && ts.isStringLiteral(arg0)) {
          const defaultMessage = arg1 && ts.isStringLiteral(arg1) ? arg1.text : undefined;
          extracted.push({ type: 't', key: arg0.text, defaultMessage, isDynamic: false });
        } else if (arg0) {
          extracted.push({ type: 't', key: node.getText(sourceFile), isDynamic: true });
        }
      }
    }

    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
      if (ts.isIdentifier(tag) && tag.text === 'Trans') {
        const attrs = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
        for (const prop of attrs.properties) {
          if (ts.isJsxAttribute(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'i18nKey') {
            if (prop.initializer && ts.isStringLiteral(prop.initializer)) {
              let defaultMessage = '';
              if (ts.isJsxElement(node)) {
                defaultMessage = node.children
                  .map((c) => c.getText(sourceFile))
                  .join('')
                  .trim();
              }
              extracted.push({ type: 'Trans', key: prop.initializer.text, defaultMessage, isDynamic: false });
            } else {
              extracted.push({ type: 'Trans', key: prop.getText(sourceFile), isDynamic: true });
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return extracted;
}

/**
 * Builds a catalog JSON structure from a list of extracted explore keys and messages.
 */
export function buildCatalogTree(keys: Array<{ key: string; defaultMessage?: string }>) {
  const catalog: Record<string, unknown> = {};

  for (const item of keys) {
    const segments = item.key.split('.');
    let current: Record<string, unknown> = catalog;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (i === segments.length - 1) {
        current[seg] = item.defaultMessage ?? '';
      } else {
        if (!current[seg] || typeof current[seg] !== 'object') {
          current[seg] = {};
        }
        current = current[seg] as Record<string, unknown>;
      }
    }
  }

  return catalog;
}

// --- Verification Test Suite ---

describe('Explore i18n E2E Verification Suite', () => {
  // --------------------------------------------------------------------------
  // Requirement A: Fallback English Text Rendering under Jest NODE_ENV === 'test'
  // --------------------------------------------------------------------------
  describe('Requirement A: Fallback English Text Rendering under Jest NODE_ENV === "test"', () => {
    it('renders default message directly when using t() without external locale bundle', () => {
      const rendered = t('explore.test.simple-message', 'Explore Default Text');
      expect(rendered).toBe('Explore Default Text');
    });

    it('renders interpolated variables correctly in fallback mode with t()', () => {
      const rendered = t('explore.test.interpolated-message', 'Showing {{total}} results for {{query}}', {
        total: 42,
        query: 'rate(http_requests_total[5m])',
      });
      expect(rendered).toBe('Showing 42 results for rate(http_requests_total[5m])');
    });

    it('renders plurals according to @grafana/i18n plural defaults convention', () => {
      const single = t('explore.test.query-count', '', {
        count: 1,
        defaultValue_one: '{{count}} query running',
        defaultValue_other: '{{count}} queries running',
      });
      expect(single).toBe('1 query running');

      const plural = t('explore.test.query-count', '', {
        count: 5,
        defaultValue_one: '{{count}} query running',
        defaultValue_other: '{{count}} queries running',
      });
      expect(plural).toBe('5 queries running');
    });

    it('renders fallback English text when using <Trans> in React DOM', () => {
      render(
        <span data-testid="trans-target">
          <Trans i18nKey="explore.test.trans-message">No data available</Trans>
        </span>
      );

      const target = screen.getByTestId('trans-target');
      expect(target).toHaveTextContent('No data available');
    });

    it('renders <Trans> with interpolated values in React DOM', () => {
      render(
        <div data-testid="trans-interpolated">
          <Trans i18nKey="explore.test.trans-interp" values={{ pane: 'Pane A' }}>
            Running in pane: {'{{pane}}'}
          </Trans>
        </div>
      );

      const target = screen.getByTestId('trans-interpolated');
      expect(target).toHaveTextContent(/Running in pane: Pane A/);
    });

    it('renders <Trans> with nested HTML tags preserving markup and fallback text', () => {
      render(
        <div data-testid="trans-nested">
          <Trans i18nKey="explore.test.trans-nested">
            Click <button type="button">here</button> to refresh
          </Trans>
        </div>
      );

      const button = screen.getByRole('button', { name: 'here' });
      expect(button).toBeInTheDocument();
      expect(screen.getByTestId('trans-nested')).toHaveTextContent('Click here to refresh');
    });

    it('handles boundary conditions: empty fallback message and special characters', () => {
      const emptyFallback = t('explore.test.empty-string', '');
      // When returnEmptyString is false in @grafana/i18n, an empty string fallback returns the key ID
      expect(emptyFallback).toBe('explore.test.empty-string');

      const specialChars = t(
        'explore.test.special-chars',
        '<Notice>: "Query & Analysis" -> 100% \'valid\' {json: true}'
      );
      expect(specialChars).toBe('<Notice>: "Query & Analysis" -> 100% \'valid\' {json: true}');
    });

    it('renders NoData component and verifies fallback English text in DOM', () => {
      render(<NoData />);
      const container = screen.getByTestId('explore-no-data');
      expect(container).toBeInTheDocument();
      expect(container).toHaveTextContent('No data');
    });

    it('renders ErrorContainer component with query error and verifies localized title fallback in DOM', () => {
      render(
        <ErrorContainer
          queryError={{
            message: 'Syntax error at line 1',
            refId: 'A',
          }}
        />
      );
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/query error/i);
      expect(alert).toHaveTextContent('Syntax error at line 1');
    });

    it('renders ErrorContainer component with unknown error and verifies fallback title in DOM', () => {
      render(<ErrorContainer />);
      const alert = screen.getByRole('alert', { hidden: true });
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Unknown error');
    });
  });

  // --------------------------------------------------------------------------
  // Requirement B: Key Format Validity (explore.<component>.<descriptor> max 3 segments)
  // --------------------------------------------------------------------------
  describe('Requirement B: Key Format Validity (explore.<component>.<descriptor> max 3 segments)', () => {
    it('accepts valid 2-segment keys in explore namespace', () => {
      const res = validateI18nKey('explore.toolbar');
      expect(res.valid).toBe(true);
      expect(res.segments).toEqual(['explore', 'toolbar']);
    });

    it('accepts valid 3-segment keys in explore namespace', () => {
      const validKeys = [
        'explore.no-data.message',
        'explore.error-container.query-error',
        'explore.error-container.unknown-error',
        'explore.run-query.pane-action-label',
        'explore.time-sync.tooltip-sync',
        'explore.time-sync.tooltip-unsync',
        'explore.query-inspector.formatted-data-description',
      ];

      for (const key of validKeys) {
        const res = validateI18nKey(key);
        expect(res.valid).toBe(true);
        expect(res.segments.length).toBeLessThanOrEqual(3);
      }
    });

    it('rejects keys exceeding 3 dot-separated segments', () => {
      const invalidKeys = [
        'explore.no-data-source-call-to-action.footer.learn-more',
        'explore.a.b.c',
        'explore.deep.nested.hierarchy.leaf',
      ];

      for (const key of invalidKeys) {
        const res = validateI18nKey(key);
        expect(res.valid).toBe(false);
        expect(res.reason).toMatch(/exceeds maximum of 3 segments/);
      }
    });

    it('rejects keys not belonging to the explore namespace', () => {
      const res = validateI18nKey('dashboard.header.refresh-label');
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/Key must start with "explore." prefix/);
    });

    it('rejects keys with non-kebab-case segments (CamelCase, PascalCase, uppercase, spaces)', () => {
      expect(validateI18nKey('explore.noData.message').valid).toBe(false);
      expect(validateI18nKey('explore.NoData.message').valid).toBe(false);
      expect(validateI18nKey('explore.no-data.MESSAGE').valid).toBe(false);
      expect(validateI18nKey('explore.no data.message').valid).toBe(false);
      expect(validateI18nKey('explore.no_data.message').valid).toBe(false);
    });

    it('verifies NoData.tsx adheres strictly to the 3-segment key convention', () => {
      const filePath = path.resolve(__dirname, '../NoData.tsx');
      const content = fs.readFileSync(filePath, 'utf8');
      const keys = extractStaticKeys(content, 'NoData.tsx');

      expect(keys.length).toBeGreaterThan(0);
      for (const item of keys) {
        expect(item.isDynamic).toBe(false);
        const val = validateI18nKey(item.key);
        expect(val.valid).toBe(true);
        expect(val.segments.length).toBeLessThanOrEqual(3);
      }
    });

    it('verifies ErrorContainer.tsx adheres strictly to the 3-segment key convention', () => {
      const filePath = path.resolve(__dirname, '../ErrorContainer.tsx');
      const content = fs.readFileSync(filePath, 'utf8');
      const keys = extractStaticKeys(content, 'ErrorContainer.tsx');

      expect(keys.length).toBe(2);
      expect(keys.map((k) => k.key)).toEqual([
        'explore.error-container.query-error',
        'explore.error-container.unknown-error',
      ]);

      for (const item of keys) {
        expect(item.isDynamic).toBe(false);
        const val = validateI18nKey(item.key);
        expect(val.valid).toBe(true);
        expect(val.segments.length).toBeLessThanOrEqual(3);
      }
    });

    it('verifies NoDataSourceCallToAction.tsx adheres strictly to the 3-segment key convention', () => {
      const filePath = path.resolve(__dirname, '../NoDataSourceCallToAction.tsx');
      const content = fs.readFileSync(filePath, 'utf8');
      const keys = extractStaticKeys(content, 'NoDataSourceCallToAction.tsx');

      const invalidSegmentKeys = keys.filter((k) => {
        const val = validateI18nKey(k.key);
        return !val.valid && val.segments.length > 3;
      });

      // Verification: All keys in NoDataSourceCallToAction must be valid 3-segment keys
      expect(invalidSegmentKeys.length).toBe(0);
      expect(keys.length).toBe(4);
      keys.forEach((k) => {
        expect(validateI18nKey(k.key).valid).toBe(true);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Requirement C: No Forbidden Direct Imports from react-i18next or i18next
  // --------------------------------------------------------------------------
  describe('Requirement C: No Forbidden Direct Imports from react-i18next or i18next', () => {
    it('import checker approves valid imports from @grafana/i18n', () => {
      const code = `
        import { Trans, t } from '@grafana/i18n';
        export const Test = () => <span>{t('explore.test.k', 'test')}</span>;
      `;
      const violations = checkForbiddenImports(code);
      expect(violations).toHaveLength(0);
    });

    it('import checker rejects direct imports from react-i18next and i18next', () => {
      const code1 = `import { useTranslation, Trans } from 'react-i18next';`;
      const code2 = `import i18next from 'i18next';`;

      expect(checkForbiddenImports(code1)).toEqual(['react-i18next']);
      expect(checkForbiddenImports(code2)).toEqual(['i18next']);
    });

    it('audits M1 Explore source files to ensure zero direct imports from react-i18next or i18next', () => {
      const m1Files = [
        path.resolve(__dirname, '../NoData.tsx'),
        path.resolve(__dirname, '../ErrorContainer.tsx'),
        path.resolve(__dirname, '../ResponseErrorContainer.tsx'),
        path.resolve(__dirname, '../NoDataSourceCallToAction.tsx'),
      ];

      for (const file of m1Files) {
        if (fs.existsSync(file)) {
          const code = fs.readFileSync(file, 'utf8');
          const violations = checkForbiddenImports(code, file);
          expect(violations).toEqual([]);
        }
      }
    });

    it('audits all Explore TypeScript source files for forbidden direct i18n imports', () => {
      const exploreDir = path.resolve(__dirname, '..');
      const files = glob.sync('**/*.{ts,tsx}', {
        cwd: exploreDir,
        absolute: true,
        ignore: ['**/*.test.{ts,tsx}', '**/spec/**', '**/mocks/**'],
      });

      const forbiddenMap: Array<{ file: string; module: string }> = [];

      for (const file of files) {
        const code = fs.readFileSync(file, 'utf8');
        const violations = checkForbiddenImports(code, file);
        for (const v of violations) {
          forbiddenMap.push({ file: path.relative(exploreDir, file), module: v });
        }
      }

      expect(forbiddenMap).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // Requirement D: No Top-Level Module Scope Calls to t()
  // --------------------------------------------------------------------------
  describe('Requirement D: No Top-Level Module Scope Calls to t()', () => {
    it('flags top-level t() calls outside functional components and getters', () => {
      const badCode = `
        import { t } from '@grafana/i18n';
        const TITLE = t('explore.test.title', 'Static Title');
        export const Comp = () => <div>{TITLE}</div>;
      `;
      const violations = checkTopLevelTCalls(badCode);
      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain("t('explore.test.title', 'Static Title')");
    });

    it('allows t() calls inside functional components', () => {
      const goodCode = `
        import { t } from '@grafana/i18n';
        const DynamicComponent = () => {
          const title = t('explore.test.title', 'Static Title');
          return <div>{title}</div>;
        };
      `;
      const violations = checkTopLevelTCalls(goodCode);
      expect(violations).toHaveLength(0);
    });

    it('allows t() calls inside getter functions or methods', () => {
      const goodCode = `
        import { t } from '@grafana/i18n';
        export function getExploreOptions() {
          return {
            label: t('explore.test.label', 'Option Label'),
          };
        }
      `;
      const violations = checkTopLevelTCalls(goodCode);
      expect(violations).toHaveLength(0);
    });

    it('audits M1 Explore source files to verify zero top-level module scope t() calls', () => {
      const m1Files = [
        path.resolve(__dirname, '../NoData.tsx'),
        path.resolve(__dirname, '../ErrorContainer.tsx'),
        path.resolve(__dirname, '../ResponseErrorContainer.tsx'),
        path.resolve(__dirname, '../NoDataSourceCallToAction.tsx'),
      ];

      for (const file of m1Files) {
        if (fs.existsSync(file)) {
          const code = fs.readFileSync(file, 'utf8');
          const violations = checkTopLevelTCalls(code, file);
          expect(violations).toEqual([]);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // Requirement E: Static Key Extraction Capability
  // --------------------------------------------------------------------------
  describe('Requirement E: Static Key Extraction Capability', () => {
    it('extracts static keys and default messages from component AST without dynamic evaluation', () => {
      const code = `
        import { t, Trans } from '@grafana/i18n';
        export const Component = () => {
          const title = t('explore.my-comp.title', 'My Component Title');
          return (
            <div>
              <h1>{title}</h1>
              <Trans i18nKey="explore.my-comp.body">Component content body</Trans>
            </div>
          );
        };
      `;

      const extracted = extractStaticKeys(code);
      expect(extracted).toHaveLength(2);
      expect(extracted).toEqual([
        {
          type: 't',
          key: 'explore.my-comp.title',
          defaultMessage: 'My Component Title',
          isDynamic: false,
        },
        {
          type: 'Trans',
          key: 'explore.my-comp.body',
          defaultMessage: 'Component content body',
          isDynamic: false,
        },
      ]);
    });

    it('correctly maps extracted Explore keys into a 3-level catalog JSON structure', () => {
      const sampleKeys = [
        { key: 'explore.no-data.message', defaultMessage: 'No data' },
        { key: 'explore.error-container.query-error', defaultMessage: 'Query error' },
        { key: 'explore.error-container.unknown-error', defaultMessage: 'Unknown error' },
      ];

      const tree = buildCatalogTree(sampleKeys);
      expect(tree).toEqual({
        explore: {
          'no-data': {
            message: 'No data',
          },
          'error-container': {
            'query-error': 'Query error',
            'unknown-error': 'Unknown error',
          },
        },
      });
    });

    it('detects dynamic keys that cannot be statically extracted by i18next-cli', () => {
      const dynamicCode = `
        import { t } from '@grafana/i18n';
        export const Comp = ({ id }: { id: string }) => {
          const msg = t(\`explore.\${id}.dynamic\`, 'Dynamic message');
          return <div>{msg}</div>;
        };
      `;

      const extracted = extractStaticKeys(dynamicCode);
      expect(extracted).toHaveLength(1);
      expect(extracted[0].isDynamic).toBe(true);
    });

    it('verifies i18next.config.ts configuration includes explore path and valid extraction parameters', () => {
      const configPath = path.resolve(__dirname, '../../../../../i18next.config.ts');
      expect(fs.existsSync(configPath)).toBe(true);

      const configContent = fs.readFileSync(configPath, 'utf8');
      expect(configContent).toContain("input: ['public/**/*.{tsx,ts}'");
      expect(configContent).toContain("functions: ['t', '*.t']");
      expect(configContent).toContain("transComponents: ['Trans']");
      expect(configContent).toContain("defaultNS: 'grafana'");
    });
  });
});
