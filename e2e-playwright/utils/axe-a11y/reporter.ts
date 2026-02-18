import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import type { AxeResults } from 'axe-core';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

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
    const axeReports = result.attachments.filter((a) => a.name.startsWith('axe-'));
    if (axeReports.length === 0) {
      return;
    }

    const testName = test
      .titlePath()
      .filter((s) => s.trim())
      .join(' > ');

    this.reports[testName] = []; // Initialize with null to indicate report is expected but not yet parsed

    for (const report of axeReports) {
      const reportJson = report.body?.toString();
      if (!reportJson) {
        console.warn(`Axe a11y report for "${testName}" has no body.`);
        continue;
      }

      // TODO: should we have a mode where we write out whether the passing report has higher thresholds than it needs,
      // or whether a rule is being excluded that doesn't need to be? This would help identify opportunities to improve our accessibility
      // over time by tightening thresholds and re-enabling rules. Maybe it's like a "verbose mode."
      try {
        const axeA11yReport: AxeResults = JSON.parse(reportJson);
        this.reports[testName] = this.reports[testName] ?? [];
        this.reports[testName].push(axeA11yReport);
        this.violations.push(
          ...axeA11yReport.violations.map((violation) => ({ testName, location: test.location, violation }))
        );
        this.failedTests += result.status === 'failed' ? 1 : 0;
      } catch (e) {
        console.error(`Failed to parse axe-a11y report JSON for test ${test.title}:`, e);
        return;
      }
    }
  }

  async onEnd(_result: FullResult) {
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
        console.info(`Axe a11y report written to ${process.env.AXE_A11Y_REPORT_PATH}`);
      } catch (e) {
        console.error('Failed to write axe-a11y report:', e);
      }
    }
  }
}

export default AxeA11yReporter;
