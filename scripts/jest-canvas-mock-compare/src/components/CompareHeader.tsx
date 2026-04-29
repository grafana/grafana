import { AssertionStatusBadge } from './AssertionStatusBadge.tsx';
import { JestActionsButtons } from './JestActions.tsx';

export function CompareHeader({
  onBackToIndex,
  testName,
  snapshotAssertionPassed,
  testPath,
  jestModalDismissed,
  jestKind,
  onViewJestOutput,
  onRerunTest,
  updateSnapshot,
  onAcceptBaseline,
  nextFailedTestBasename,
  onNextFailedTest,
}: {
  onBackToIndex: () => void;
  testName: string;
  snapshotAssertionPassed: undefined | boolean;
  testPath: string | undefined;
  jestModalDismissed: boolean;
  jestKind: 'idle' | 'running' | 'success' | 'error';
  onViewJestOutput: () => void;
  onRerunTest: () => void;
  updateSnapshot: undefined | boolean;
  onAcceptBaseline: () => void;
  nextFailedTestBasename: string | null;
  onNextFailedTest: () => void;
}) {
  return (
    <div className="compare-title-row">
      <div className="compare-title-leading">
        <button type="button" className="compare-back-btn" onClick={onBackToIndex} aria-label="Back to payload list">
          ← Back
        </button>
        <h3 className="compare-title">Test: {testName}</h3>
      </div>
      {snapshotAssertionPassed !== undefined ? <AssertionStatusBadge passed={snapshotAssertionPassed} /> : null}
      <div className="compare-title-actions">
        {testPath && jestModalDismissed && (jestKind === 'success' || jestKind === 'error') ? (
          <button type="button" className="jest-view-output-btn" onClick={onViewJestOutput}>
            View jest output
          </button>
        ) : null}
        <JestActionsButtons
          passed={snapshotAssertionPassed ?? false}
          kind={jestKind}
          onRerunTest={onRerunTest}
          updateSnapshot={updateSnapshot}
          onAcceptBaseline={onAcceptBaseline}
        />
        <button
          type="button"
          className="compare-next-failed-btn"
          disabled={nextFailedTestBasename === null}
          onClick={onNextFailedTest}
          title={
            nextFailedTestBasename === null
              ? 'No other payload with a failing snapshot (or status still loading)'
              : 'Open the next payload whose snapshot assertion failed'
          }
        >
          Next failed test
        </button>
      </div>
    </div>
  );
}
