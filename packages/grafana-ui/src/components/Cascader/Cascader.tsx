import { TreeSelectBase } from './TreeSelectImplementation';
import { type CascaderProps } from './types';

export type { CascaderOption, CascaderProps } from './types';

/**
 * The cascader component is a searchable tree selector for hierarchical options.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-cascader--docs
 */
export function Cascader(props: CascaderProps) {
  return <TreeSelectBase {...props} changeOnSelect={props.changeOnSelect ?? true} />;
}
