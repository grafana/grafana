import { AssertionStatusBadge } from './AssertionStatusBadge.tsx';
import { JestActionsButtons } from './JestActions.tsx';

export function CompareHeader(props: {
  onClick: () => void;
  testName: string;
  snapshotAssertionPassed: undefined | boolean;
  testPath: string | undefined;
  jestModalDismissed: boolean;
  jestKind: 'idle' | 'running' | 'success' | 'error';
  onClick1: () => void;
  onRerunTest: () => void;
  updateSnapshot: undefined | boolean;
  onAcceptBaseline: () => void;
  nextFailedTestBasename: string | null;
  onClick2: () => void;
}) {
  return (
    <div className="compare-title-row">
      <div className="compare-title-leading">
        <button type="button" className="compare-back-btn" onClick={props.onClick} aria-label="Back to payload list">
          ← Back
        </button>
        <h3 className="compare-title">Test: {props.testName}</h3>
      </div>
      {props.snapshotAssertionPassed !== undefined ? (
        <AssertionStatusBadge passed={props.snapshotAssertionPassed} />
      ) : null}
      <div className="compare-title-actions">
        {props.testPath && props.jestModalDismissed && (props.jestKind === 'success' || props.jestKind === 'error') ? (
          <button type="button" className="jest-view-output-btn" onClick={props.onClick1}>
            View jest output
          </button>
        ) : null}
        <JestActionsButtons
          passed={props.snapshotAssertionPassed ?? false}
          kind={props.jestKind}
          onRerunTest={props.onRerunTest}
          updateSnapshot={props.updateSnapshot}
          onAcceptBaseline={props.onAcceptBaseline}
        />
        <button
          type="button"
          className="compare-next-failed-btn"
          disabled={props.nextFailedTestBasename === null}
          onClick={props.onClick2}
          title={
            props.nextFailedTestBasename === null
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
