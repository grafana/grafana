import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Input, useStyles2 } from '@grafana/ui';
import { Props as InputProps } from '@grafana/ui/src/components/Input/Input';
import { getFocusStyle, sharedInputStyle } from '@grafana/ui/src/components/Forms/commonStyles';
import React, { useEffect } from 'react';
export interface Props extends InputProps {
  /** Sets the min-width to a multiple of 8px. Default value is 10*/
  minWidth?: number;
  /** Sets the max-width to a multiple of 8px.*/
  maxWidth?: number;
  /** onChange function that will be run on onBlur and onKeyPress with enter*/
  onCommitChange?: (event: React.FormEvent<HTMLInputElement>) => void;
}

export const AutoSizeInput = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const { defaultValue = '', minWidth = 10, maxWidth, onCommitChange, ...restProps } = props;
  const [value, setValue] = React.useState(defaultValue);
  const [inputWidth, setInputWidth] = React.useState(minWidth);

  const styles = useStyles2(getStyles);
  const sizerRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const extraSpace = 4;
    const calculateWidth = (number: number) => number / 8;
    let newInputWidth = sizerRef.current ? calculateWidth(sizerRef.current.scrollWidth) + extraSpace : 0;

    if (!value) {
      newInputWidth = minWidth;
    } else {
      if (newInputWidth < minWidth) {
        newInputWidth = minWidth;
      }

      if (maxWidth && newInputWidth > maxWidth) {
        newInputWidth = maxWidth;
      }
    }

    if (newInputWidth !== inputWidth) {
      setInputWidth(newInputWidth);
    }
  }, [sizerRef.current?.scrollWidth, inputWidth, value, maxWidth, minWidth]);

  return (
    <>
      <Input
        {...restProps}
        ref={ref}
        value={value.toString()}
        onChange={(event) => {
          setValue(event.currentTarget.value);
        }}
        width={inputWidth}
        onBlur={(event) => {
          if (onCommitChange) {
            onCommitChange(event);
          }
        }}
        onKeyDown={(evt) => {
          if (evt.key === 'Enter' && onCommitChange) {
            onCommitChange(evt);
          }
        }}
      />
      <div ref={sizerRef} className={styles.sizer}>
        {value}
      </div>
    </>
  );
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    input: cx(
      getFocusStyle(theme.v1),
      sharedInputStyle(theme),
      css`
        min-height: 30px;
        box-sizing: content-box;
      `
    ),
    sizer: css`
      position: absolute;
      top: 0;
      left: 0;
      visibility: hidden;
      height: 0;
      overflow: scroll;
      whitespace: pre;
    `,
  };
};

AutoSizeInput.displayName = 'AutoSizeInput';
