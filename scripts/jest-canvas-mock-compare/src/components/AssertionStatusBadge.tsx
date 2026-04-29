export function AssertionStatusBadge({ passed, compact }: { passed: boolean; compact?: boolean }) {
  return (
    <span
      className={`compare-snapshot-status${passed ? ' is-pass' : ' is-fail'}${compact ? ' is-compact' : ''}`}
      title="Whether the test passed when this payload was written"
    >
      {passed ? 'passed' : 'failed'}
    </span>
  );
}
