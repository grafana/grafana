import { lazy, Suspense } from 'react';

import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';

import { type ButtonCascaderProps } from './types';

const ButtonCascaderImplementation = lazy(() =>
  import(/* webpackChunkName: "headless-tree-select" */ './ButtonCascader').then((module) => ({
    default: module.ButtonCascader,
  }))
);

export const ButtonCascader = (props: ButtonCascaderProps) => {
  const { buttonProps, children, disabled, hideDownIcon, icon, variant } = props;

  return (
    <Suspense
      fallback={
        <Button icon={icon} disabled={disabled} variant={variant} {...(buttonProps ?? {})}>
          {children}
          {!hideDownIcon && <Icon name="angle-down" />}
        </Button>
      }
    >
      <ButtonCascaderImplementation {...props} />
    </Suspense>
  );
};

ButtonCascader.displayName = 'ButtonCascader';

export type { ButtonCascaderProps, CascaderFieldNames } from './types';
