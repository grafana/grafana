import { cx, css } from '@emotion/css';
import React, { HTMLProps, useRef, useState } from 'react';
import useClickAway from 'react-use/lib/useClickAway';

import { useStyles2 } from '../../themes';
import { measureText } from '../../utils/measureText';
import { InlineLabel } from '../Forms/InlineLabel';

import { getSegmentStyles } from './styles';

import { useExpandableLabel, SegmentProps } from '.';

export interface SegmentInputProps<T>
  extends Omit<SegmentProps<T>, 'allowCustomValue' | 'allowEmptyValue'>,
    Omit<HTMLProps<HTMLInputElement>, 'value' | 'onChange'> {
  value: string | number;
  onChange: (text: string | number) => void;
}

const FONT_SIZE = 14;

export function SegmentInput<T>({
  value: initialValue,
  onChange,
  Component,
  className,
  placeholder,
  inputPlaceholder,
  disabled,
  autofocus = false,
  onExpandedChange,
  ...rest
}: React.PropsWithChildren<SegmentInputProps<T>>) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState<number | string>(initialValue);
  const [inputWidth, setInputWidth] = useState<number>(measureText((initialValue || '').toString(), FONT_SIZE).width);
  const [Label, , expanded, setExpanded] = useExpandableLabel(autofocus, onExpandedChange);
  const styles = useStyles2(getSegmentStyles);

  useClickAway(ref, () => {
    setExpanded(false);
    onChange(value);
  });

  if (!expanded) {
    return (
      <Label
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
              {initialValue || placeholder}
            </InlineLabel>
          )
        }
      />
    );
  }

  const inputWidthStyle = css`
    width: ${Math.max(inputWidth + 20, 32)}px;
  `;

  return (
    <input
      {...rest}
      ref={ref}
      // this needs to autofocus, but it's ok as it's only rendered by choice
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus
      className={cx(`gf-form gf-form-input`, inputWidthStyle)}
      value={value}
      placeholder={inputPlaceholder}
      onChange={(item) => {
        const { width } = measureText(item.target.value, FONT_SIZE);
        setInputWidth(width);
        setValue(item.target.value);
      }}
      onBlur={() => {
        setExpanded(false);
        onChange(value);
      }}
      onKeyDown={(e) => {
        if ([13, 27].includes(e.keyCode)) {
          setExpanded(false);
          onChange(value);
        }
      }}
    />
  );
}
