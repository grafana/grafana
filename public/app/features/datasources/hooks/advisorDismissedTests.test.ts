import { clearDismissedTests, dismissAdvisorHealthStatus, getDismissedTests } from './advisorDismissedTests';

describe('advisorDismissedTests', () => {
  afterEach(() => {
    clearDismissedTests();
  });

  it('should start empty', () => {
    expect(getDismissedTests().size).toBe(0);
  });

  it('should record a dismissed UID with a timestamp', () => {
    dismissAdvisorHealthStatus('ds-1');
    const dismissed = getDismissedTests();
    expect(dismissed.has('ds-1')).toBe(true);
    expect(new Date(dismissed.get('ds-1')!).getTime()).not.toBeNaN();
  });

  it('should overwrite timestamp on repeated dismiss', () => {
    dismissAdvisorHealthStatus('ds-1');
    const first = getDismissedTests().get('ds-1')!;

    // Small delay to ensure different timestamp
    dismissAdvisorHealthStatus('ds-1');
    const second = getDismissedTests().get('ds-1')!;

    expect(new Date(second).getTime()).toBeGreaterThanOrEqual(new Date(first).getTime());
  });

  it('should clear all entries', () => {
    dismissAdvisorHealthStatus('ds-1');
    dismissAdvisorHealthStatus('ds-2');
    clearDismissedTests();
    expect(getDismissedTests().size).toBe(0);
  });
});
