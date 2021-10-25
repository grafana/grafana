import React, { useRef } from 'react';
import { MonacoQueryFieldLazy } from './MonacoQueryFieldLazy';
import { Props as MonacoProps } from './MonacoQueryFieldProps';

// NOTE: the behavior is different between in-explore-mode
// and in-dashboard-mode. the way this is signalized
// is by the onBlur prop:
// - if onBlur is not nullish => explore-mode, so we do not run the query on blur
// - if onBlur is nullish     => dashboard-mode, so we do run the query on blur
// FIXME: this could be probably done in a better way,
// because for example, in explore-mode, onBlur is not nullish, but it is just an empty-function,
// purely used to signalize the explore-situation. we could probably
// replace it with a boolean or something.
// but, to keep the monaco-widget compatible with the non-monaco widget,
// we will keep this behavior, and extract it to a separate file,
// because this needs keeping around the previously run value etc,
// and i did not want to make the monaco widget even more complex.

// the props are mostly what is the inner monaco widget,
// except the `on*` callbacks
type Props = Omit<MonacoProps, 'onRunQuery' | 'onBlur'> & {
  onChange: (query: string) => void;
  onRunQuery: () => void;
  onBlur?: () => void;
};

export const MonacoQueryFieldWrapper = (props: Props) => {
  const lastRunValueRef = useRef<string | null>(null);
  const { onBlur, onRunQuery, onChange, ...rest } = props;

  const handleRunQuery = (value: string) => {
    lastRunValueRef.current = value;
    onChange(value);
    onRunQuery();
  };

  const handleBlur = (value: string) => {
    if (onBlur !== undefined) {
      // explore-mode
      onChange(value);
      onBlur();
    } else {
      // dashboard-mode
      // is the current value different from the last-time-executed value?
      if (value !== lastRunValueRef.current) {
        handleRunQuery(value);
      }
    }
  };

  return <MonacoQueryFieldLazy onRunQuery={handleRunQuery} onBlur={handleBlur} {...rest} />;
};
