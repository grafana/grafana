const dismissedTests = new Map<string, string>();

export function dismissAdvisorHealthStatus(uid: string, timestamp?: string): void {
  dismissedTests.set(uid, timestamp ?? new Date().toISOString());
}

export function getDismissedTests(): ReadonlyMap<string, string> {
  return dismissedTests;
}

export function clearDismissedTests(): void {
  dismissedTests.clear();
}
