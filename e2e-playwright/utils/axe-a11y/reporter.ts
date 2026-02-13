import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import type { AxeResults, Result as AxeResult } from 'axe-core';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { AXE_A11Y_ANNOTATION_TYPE } from './constants';

class AxeA11yReporter implements Reporter {
  private violations: Array<{ testName: string; violation: AxeResult }> = [];
  private testsWithViolations = 0;
  private failedTests = 0;
  private totalTests = 0;
  private reports: Record<string, AxeResults> = {};

  onTestEnd(test: TestCase, result: TestResult) {
    const axeA11yAnnotation = result.annotations.find((a) => a.type === AXE_A11Y_ANNOTATION_TYPE);
    if (axeA11yAnnotation) {
      this.totalTests += 1;

      const reportJson = axeA11yAnnotation.description;
      if (!reportJson) {
        console.error(`No report found in axe-a11y annotation for test ${test.title}`);
        return;
      }

      try {
        const axeA11yReport: AxeResults = JSON.parse(reportJson);
        const testName = test
          .titlePath()
          .filter((s) => s.trim())
          .join(' > ');
        this.totalTests += 1;
        if (axeA11yReport.violations.length > 0) {
          this.testsWithViolations += 1;
          axeA11yReport.violations.forEach((v) => this.violations.push({ testName, violation: v }));
        }
        this.failedTests += result.status === 'failed' ? 1 : 0;
        this.reports[testName] = axeA11yReport;
      } catch (e) {
        console.error(`Failed to parse axe-a11y report JSON for test ${test.title}:`, e);
        return;
      }
    }
  }

  async onEnd(_result: FullResult) {
    console.log('--- [axe-a11y] Accessibility Test Summary ---');
    console.log(`- Total tests: ${this.totalTests}`);
    console.log(`- Tests with violations: ${this.testsWithViolations}`);
    console.log(`- Failed tests: ${this.failedTests}`);
    console.log(`- Accessibility violations: ${this.violations.length}`);

    if (process.env.AXE_A11Y_REPORT_PATH) {
      const report = {
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
    }

    console.log('---------------------------------------------');
  }
}

export default AxeA11yReporter;
