import { cx } from '@emotion/css';
import { isObject } from 'lodash';
import { HTMLProps } from 'react';
import * as React from 'react';
import { useAsyncFn } from 'react-use';
import { AsyncState } from 'react-use/lib/useAsync';

import { SelectableValue } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { t } from '../../utils/i18n';
import { InlineLabel } from '../Forms/InlineLabel';

import { SegmentSelect } from './SegmentSelect';
import { getSegmentStyles } from './styles';
import { SegmentProps } from './types';
import { useExpandableLabel } from './useExpandableLabel';

export interface SegmentAsyncProps<T> extends SegmentProps, Omit<HTMLProps<HTMLDivElement>, 'value' | 'onChange'> {
  value?: T | SelectableValue<T>;
  loadOptions: (query?: string) => Promise<Array<SelectableValue<T>>>;
  /**
   *  If true options will be reloaded when user changes the value in the input,
   *  otherwise, options will be loaded when the segment is clicked
   */
  reloadOptionsOnChange?: boolean;
  onChange: (item: SelectableValue<T>) => void;
  noOptionMessageHandler?: (state: AsyncState<Array<SelectableValue<T>>>) => string;
  inputMinWidth?: number;
}

export function SegmentAsync<T>({
  value,
  onChange,
  loadOptions,
  reloadOptionsOnChange = false,
  Component,
  className,
  allowCustomValue,
  allowEmptyValue,
  disabled,
  placeholder,
  inputMinWidth,
  inputPlaceholder,
  autofocus = false,
  onExpandedChange,
  noOptionMessageHandler = mapStateToNoOptionsMessage,
  ...rest
}: React.PropsWithChildren<SegmentAsyncProps<T>>) {
  const [state, fetchOptions] = useAsyncFn(loadOptions, [loadOptions]);
  const [Label, labelWidth, expanded, setExpanded] = useExpandableLabel(autofocus, onExpandedChange);
  const width = inputMinWidth ? Math.max(inputMinWidth, labelWidth) : labelWidth;
  const styles = useStyles2(getSegmentStyles);

  if (!expanded) {
    const label = isObject(value) ? value.label : value;
    const labelAsString = label != null ? String(label) : undefined;

    return (
      <Label
        onClick={reloadOptionsOnChange ? undefined : fetchOptions}
        disabled={disabled}
        Component={
          Component || (
            <InlineLabel
              className={cx(
                styles.segment,
                {
                  [styles.queryPlaceholder]: placeholder !== undefined && !value,
                  [styles.disabled]: disabled,
                },
                className
              )}
            >
              {labelAsString || placeholder}
            </InlineLabel>
          )
        }
      />
    );
  }

  return (
    <SegmentSelect
      {...rest}
      value={value && !isObject(value) ? { value } : value}
      placeholder={inputPlaceholder}
      options={state.value ?? []}
      loadOptions={reloadOptionsOnChange ? fetchOptions : undefined}
      width={width}
      noOptionsMessage={noOptionMessageHandler(state)}
      allowCustomValue={allowCustomValue}
      allowEmptyValue={allowEmptyValue}
      onClickOutside={() => {
        setExpanded(false);
      }}
      onChange={(item) => {
        setExpanded(false);
        onChange(item);
      }}
    />
  );
}

function mapStateToNoOptionsMessage<T>(state: AsyncState<Array<SelectableValue<T>>>): string {
  if (state.loading) {
    return t('grafana-ui.segment-async.loading', 'Loading options...');
  }

  if (state.error) {
    return t('grafana-ui.segment-async.error', 'Failed to load options');
  }

  return t('grafana-ui.segment-async.no-options', 'No options found');
}
