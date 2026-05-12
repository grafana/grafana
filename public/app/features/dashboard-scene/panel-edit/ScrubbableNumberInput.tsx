import { css } from '@emotion/css';
import * as React from 'react';
import { useRef, useState, useCallback } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  width?: number;
}

export function ScrubbableNumberInput({ value, onChange, min, max, step = 1, suffix, width = 64 }: Props) {
  const styles = useStyles2(getStyles);
  const [scrubbing, setScrubbing] = useState(false);
  const originX = useRef(0);
  const originVal = useRef(value);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      originX.current = e.clientX;
      originVal.current = value;
      setScrubbing(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [value]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      if (!scrubbing) {
        return;
      }
      const delta = Math.round((e.clientX - originX.current) / 2) * step;
      let next = originVal.current + delta;
      if (min !== undefined) {
        next = Math.max(min, next);
      }
      if (max !== undefined) {
        next = Math.min(max, next);
      }
      onChange(Math.round(next / step) * step);
    },
    [scrubbing, step, min, max, onChange]
  );

  const onPointerUp = useCallback(() => {
    setScrubbing(false);
  }, []);

  return (
    <div className={styles.wrap} style={{ width }}>
      <input
        type="number"
        className={styles.input}
        value={value}
        min={min}
        max={max}
        step={step}
        style={{ cursor: scrubbing ? 'ew-resize' : 'ew-resize' }}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) {
            onChange(n);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrap: css({
      display: 'inline-flex',
      alignItems: 'center',
      background: theme.colors.background.canvas,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      height: 26,
      padding: '0 4px',
      overflow: 'hidden',
    }),
    input: css({
      flex: 1,
      minWidth: 0,
      background: 'transparent',
      border: 'none',
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      padding: 0,
      outline: 'none',
      textAlign: 'center',
      MozAppearance: 'textfield',
      '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
        WebkitAppearance: 'none',
        margin: 0,
      },
      ':focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '-2px',
      },
    }),
    suffix: css({
      fontSize: 10,
      color: theme.colors.text.disabled,
      fontFamily: theme.typography.fontFamilyMonospace,
      marginLeft: 2,
      flexShrink: 0,
    }),
  };
}
