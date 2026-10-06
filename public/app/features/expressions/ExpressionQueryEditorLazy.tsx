import { lazy, Suspense } from 'react';

import { type ExpressionQueryEditorProps } from './ExpressionQueryEditor';

const ExpressionQueryEditor = lazy(() =>
  import('./ExpressionQueryEditor').then((module) => ({ default: module.ExpressionQueryEditor }))
);

export function ExpressionQueryEditorLazy(props: ExpressionQueryEditorProps) {
  return (
    <Suspense fallback={null}>
      <ExpressionQueryEditor {...props} />
    </Suspense>
  );
}
