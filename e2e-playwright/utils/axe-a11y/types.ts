import type { Location } from '@playwright/test/reporter';
import type { AxeResults, Result as AxeResult } from 'axe-core';

export interface AxeA11yReportViolation {
  testName: string;
  location: Location;
  violation: AxeResult;
}

export interface AxeA11yReport {
  summary: {
    totalTests: number;
    testsWithViolations: number;
    failedTests: number;
    violationsCount: number;
  };
  violations: AxeA11yReportViolation[];
  rawReports: Record<string, AxeResults[] | null>;
}
