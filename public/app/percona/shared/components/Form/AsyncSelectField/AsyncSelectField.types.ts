import { SelectableValue } from '@grafana/data';
import { SelectAsyncProps, SelectCommonProps } from '@grafana/ui/src/components/Select/types';

export interface AsyncSelectFieldProps<T> extends Omit<SelectCommonProps<T>, 'options'>, SelectAsyncProps<T> {
  // AsyncSelect has options stored internally. We cannot enable plain values as we don't have access to the fetched options
  value?: SelectableValue<T>;
  invalid?: boolean;
  className?: string;
  label: string;
  name: string;
}
