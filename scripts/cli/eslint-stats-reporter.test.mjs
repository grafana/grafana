import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import statsReporter from './eslint-stats-reporter.mjs';

describe('ESLint suppression metrics', () => {
  it('combines new rules by ID across files regardless of diagnostic text', () => {
    const output = statsReporter([
      {
        suppressedMessages: [
          { ruleId: 'example/new-rule', message: 'First diagnostic at /first.ts:10', suppressions: [{ kind: 'file' }] },
          {
            ruleId: 'example/other-rule',
            message: 'First diagnostic at /first.ts:10',
            suppressions: [{ kind: 'file' }],
          },
        ],
      },
      {
        suppressedMessages: [
          {
            ruleId: 'example/new-rule',
            message: 'Different diagnostic at /second.ts:20',
            suppressions: [{ kind: 'file' }],
          },
          { ruleId: 'example/new-rule', message: 'Inline disable', suppressions: [{ kind: 'directive' }] },
          {
            ruleId: 'example/new-rule',
            message: 'File and inline disable',
            suppressions: [{ kind: 'file' }, { kind: 'directive' }],
          },
        ],
      },
    ]);

    assert.equal(output, 'betterEslint_exampleNewRule 2\nbetterEslint_exampleOtherRule 1');
  });

  it('keeps separate message-based metrics for deny-listed rules', () => {
    const output = statsReporter([
      {
        suppressedMessages: [
          { ruleId: 'react-hooks/exhaustive-deps', message: 'Missing dependency', suppressions: [{ kind: 'file' }] },
          {
            ruleId: 'react-hooks/exhaustive-deps',
            message: 'Unnecessary dependency',
            suppressions: [{ kind: 'file' }],
          },
        ],
      },
    ]);

    assert.equal(output, 'betterEslint_missingDependency 1\nbetterEslint_unnecessaryDependency 1');
  });

  it('preserves legacy metric names and prefixes', () => {
    const output = statsReporter([
      {
        suppressedMessages: [
          {
            ruleId: '@typescript-eslint/no-explicit-any',
            message: 'Unexpected any. Specify a different type.',
            suppressions: [{ kind: 'file' }],
          },
          /* eslint-disable @grafana/no-gf-form -- Test the legacy metric for this rule. */
          {
            ruleId: '@grafana/no-gf-form',
            message: 'gf-form usage has been deprecated. Use a component from @grafana/ui or custom CSS instead.',
            suppressions: [{ kind: 'file' }],
          },
          /* eslint-enable @grafana/no-gf-form */
        ],
      },
    ]);

    assert.equal(
      output,
      'betterEslint_unexpectedAnySpecifyADifferentType 1\n' +
        'noGfFormUsage_gfFormUsageHasBeenDeprecatedUseAComponentFromGrafanaUiOrCustomCssInstead 1'
    );
  });

  it('uses the diagnostic message when no rule ID is available', () => {
    const output = statsReporter([
      { suppressedMessages: [{ ruleId: null, message: 'Missing rule ID', suppressions: [{ kind: 'file' }] }] },
    ]);

    assert.equal(output, 'betterEslint_missingRuleId 1');
  });
});
