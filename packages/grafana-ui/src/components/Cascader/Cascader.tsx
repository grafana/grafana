import { memo } from 'react';

import { HeadlessTreeSelect } from './TreeSelectImplementation';
import { type CascaderProps } from './types';

export type { CascaderOption, CascaderProps } from './types';

/**
 * The cascader component is a searchable tree selector for hierarchical options.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-cascader--docs
 */
export const Cascader = memo((props: CascaderProps) => {
  return <HeadlessTreeSelect {...props} changeOnSelect={props.changeOnSelect ?? true} />;
});

Cascader.displayName = 'Cascader';
