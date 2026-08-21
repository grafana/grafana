import { lazy, memo, Suspense } from 'react';

import { Input } from '../Input/Input';

import { type TreeSelectProps } from './TreeSelectImplementation';

const LazyTreeSelect = lazy(() =>
  import(/* webpackChunkName: "headless-tree-select" */ './TreeSelectImplementation').then((module) => ({
    default: module.TreeSelectImplementation,
  }))
);

export const TreeSelect = memo((props: TreeSelectProps) => {
  return (
    <Suspense
      fallback={
        <div data-testid={props['data-testid']}>
          <Input
            id={props.id}
            width={props.width}
            placeholder={props.placeholder}
            disabled={props.disabled}
            loading
            readOnly
          />
        </div>
      }
    >
      <LazyTreeSelect {...props} />
    </Suspense>
  );
});

TreeSelect.displayName = 'TreeSelect';

export type { TreeSelectProps } from './TreeSelectImplementation';
