import { lazy, Suspense } from 'react';

import { type CellContentKind } from 'app/features/notebook/types';

export interface CodeCellProps {
  content: CellContentKind;
  isEditing: boolean;
  /** Set on a cell the reader just inserted, so they can type into it without clicking it first. */
  autoFocus?: boolean;
  onChange: (content: CellContentKind) => void;
}

const CodeCellImplementation = lazy(() =>
  import(/* webpackChunkName: "notebook-code-cell" */ './CodeCellImplementation').then((module) => ({
    default: module.CodeCellImplementation,
  }))
);

export function CodeCell(props: CodeCellProps) {
  if (props.content.kind !== 'Code') {
    return null;
  }

  return (
    <Suspense fallback={<pre>{props.content.spec.code}</pre>}>
      <CodeCellImplementation {...props} />
    </Suspense>
  );
}
