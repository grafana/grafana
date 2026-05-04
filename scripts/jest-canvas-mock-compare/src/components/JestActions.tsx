import { useEffect, useRef } from 'react';

export type JestActionKind = 'idle' | 'running' | 'success' | 'error';

interface JestActionsButtonsProps {
  passed: boolean;
  kind: JestActionKind;
  onRerunTest: () => void;
  updateSnapshot?: boolean;
  onAcceptBaseline: () => void;
}

export interface JestOutputPanelProps {
  kind: JestActionKind;
  updateSnapshot?: boolean;
  message?: string;
  command: string | undefined;
  stdout: string;
  stderr: string;
}

interface JestOutputModalProps extends JestOutputPanelProps {
  open: boolean;
  onClose: () => void;
}

export function JestActionsButtons(props: JestActionsButtonsProps) {
  return (
    <div className="accept-baseline-actions">
      <button
        type="button"
        className="jest-rerun-btn"
        disabled={props.kind === 'running'}
        title={'Run jest for this test only (does not update snapshots)'}
        onClick={props.onRerunTest}
      >
        {props.kind === 'running' && !props.updateSnapshot ? 'Running jest…' : 'Re-run test'}
      </button>
      <button
        type="button"
        className="accept-baseline-btn"
        disabled={props.kind === 'running' || props.kind === 'success' || props.passed}
        title={
          props.kind === 'success' || props.passed
            ? 'Snapshot already matches actual'
            : 'Run jest with --updateSnapshot for this test only'
        }
        onClick={props.onAcceptBaseline}
      >
        {props.kind === 'running' && props.updateSnapshot ? 'Running jest -u…' : 'Accept actual (jest -u)'}
      </button>
    </div>
  );
}

function TestOutputHeader(props: {
  kind: 'success' | 'error' | 'idle' | 'running';
  updateSnapshot: boolean | undefined;
  message: string | undefined;
}) {
  return (
    <>
      {props.kind === 'success' && props.updateSnapshot ? (
        <p className="accept-baseline-success" role="status">
          Snapshot updated.
        </p>
      ) : null}
      {props.kind === 'success' && !props.updateSnapshot ? (
        <p className="accept-baseline-success" role="status">
          Test passed.
        </p>
      ) : null}
      {props.kind === 'error' ? (
        <p className="accept-baseline-error" role="alert">
          {props.message}
        </p>
      ) : null}
    </>
  );
}

export function JestOutputPanel(props: JestOutputPanelProps) {
  if (props.kind === 'idle') {
    return null;
  }
  if (props.kind === 'running') {
    return (
      <div className="jest-output-running" role="status">
        <p className="jest-output-running-msg">Running jest…</p>
      </div>
    );
  }
  return (
    <div className="accept-baseline-output">
      {props.command ? <pre className="accept-baseline-command">{props.command}</pre> : null}
      {props.stdout ? <pre className="accept-baseline-stdout">{props.stdout}</pre> : null}
      {props.stderr ? <pre className="accept-baseline-stderr">{props.stderr}</pre> : null}
    </div>
  );
}

export function JestOutputModal(props: JestOutputModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    if (props.open) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [props.open]);

  return (
    <dialog
      ref={ref}
      className="jest-output-modal"
      onCancel={(event) => {
        event.preventDefault();
        props.onClose();
      }}
    >
      <div className="jest-output-modal-inner">
        <div className="jest-output-modal-header">
          <TestOutputHeader kind={props.kind} updateSnapshot={props.updateSnapshot} message={props.message} />
          <button type="button" className="jest-output-modal-close" onClick={props.onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="jest-output-modal-body">
          <JestOutputPanel
            kind={props.kind}
            updateSnapshot={props.updateSnapshot}
            message={props.message}
            command={props.command}
            stdout={props.stdout}
            stderr={props.stderr}
          />
        </div>
      </div>
    </dialog>
  );
}
