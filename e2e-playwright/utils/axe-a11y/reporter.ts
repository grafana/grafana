import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import type { AxeResults } from 'axe-core';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { AXE_A11Y_ANNOTATION_TYPE } from './constants';
import { AxeA11yReport, AxeA11yReportViolation } from './types';

class AxeA11yReporter implements Reporter {
  private violations: AxeA11yReportViolation[] = [];

  private failedTests = 0;
  private reports: AxeA11yReport['rawReports'] = {};

  private get totalTests() {
    return Object.keys(this.reports).length;
  }

  private get testsWithViolations() {
    const set = new Set<string>();
    for (const { testName } of this.violations) {
      set.add(testName);
    }
    return set.size;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const axeA11yAnnotation = result.annotations.find((a) => a.type === AXE_A11Y_ANNOTATION_TYPE);
    if (!axeA11yAnnotation) {
      return;
    }

    const testName = test
      .titlePath()
      .filter((s) => s.trim())
      .join(' > ');

    this.reports[testName] = null; // Initialize with null to indicate report is expected but not yet parsed

    const reportJson = axeA11yAnnotation.description;
    if (!reportJson) {
      console.error(`No report found in axe-a11y annotation for test ${testName}`);
      return;
    }

    try {
      const axeA11yReport: AxeResults = JSON.parse(reportJson);
      this.reports[testName] = axeA11yReport;
      this.violations.push(
        ...axeA11yReport.violations.map((violation) => ({ testName, location: test.location, violation }))
      );
      this.failedTests += result.status === 'failed' ? 1 : 0;
    } catch (e) {
      console.error(`Failed to parse axe-a11y report JSON for test ${test.title}:`, e);
      return;
    }
  }

  async onEnd(_result: FullResult) {
    if (this.totalTests === 0) {
      return;
    }

    console.log('--- [axe-a11y] Accessibility Test Summary ---');
    console.log(`Total a11y tests: ${this.totalTests}`);
    if (this.violations.length > 0) {
      console.log(`Violations (${this.violations.length}):`);

      for (const { testName, violation, location } of this.violations) {
        console.log(`• Test:      ${testName}`);
        console.log(`             (${location.file}:${location.line}:${location.column})`);
        console.log(`  Violation: ${violation.help} (${violation.helpUrl})`);
        console.log(`  Impact:    ${violation.impact}`);

        const nodePrintLimit = 5;
        for (let i = 0; i < violation.nodes.length && i < nodePrintLimit; i++) {
          console.log(`  ${i === 0 ? 'Nodes:' : '      '}     • ${violation.nodes[i].html}`);
        }
        if (violation.nodes.length > nodePrintLimit) {
          console.log(`             ... and ${violation.nodes.length - nodePrintLimit} more node(s)`);
        }

        console.log('');
      }
    } else {
      console.log('No violations found! 🏆');
    }

    if (process.env.AXE_A11Y_REPORT_PATH) {
      try {
        const report: AxeA11yReport = {
          summary: {
            totalTests: this.totalTests,
            testsWithViolations: this.testsWithViolations,
            failedTests: this.failedTests,
            violationsCount: this.violations.length,
          },
          violations: this.violations,
          rawReports: this.reports,
        };
        await writeFile(path.join(process.cwd(), process.env.AXE_A11Y_REPORT_PATH), JSON.stringify(report, null, 2));
        console.info(`\nReport: ${process.env.AXE_A11Y_REPORT_PATH}`);
      } catch (e) {
        console.error('Failed to write axe-a11y report:', e);
      }
    }

    console.log('---------------------------------------------');
  }
}

export default AxeA11yReporter;
