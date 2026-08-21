import { lazy, memo, Suspense } from 'react';

import { Input } from '../Input/Input';

import { type CascaderProps } from './types';

const CascaderImplementation = lazy(() =>
  import(/* webpackChunkName: "headless-tree-select" */ './Cascader').then((module) => ({
    default: module.Cascader,
  }))
);

export const Cascader = memo((props: CascaderProps) => {
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
      <CascaderImplementation {...props} />
    </Suspense>
  );
});

Cascader.displayName = 'Cascader';

export type { CascaderOption, CascaderProps } from './types';
