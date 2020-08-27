import React, { FC, CSSProperties, HTMLProps } from 'react';
import { FormattedValue } from '@grafana/data';

export interface Props extends Omit<HTMLProps<HTMLDivElement>, 'className' | 'value' | 'style'> {
  className?: string;
  value: FormattedValue;
  style: CSSProperties;
}

function fontSizeReductionFactor(fontSize: number) {
  if (fontSize < 20) {
    return 0.9;
  }
  if (fontSize < 26) {
    return 0.8;
  }
  return 0.6;
}

export const FormattedValueDisplay: FC<Props> = ({ value, className, style, ...htmlProps }) => {
  const fontSize = style.fontSize as number;
  const reductionFactor = fontSizeReductionFactor(fontSize);
  const hasPrefix = (value.prefix ?? '').length > 0;
  const hasSuffix = (value.suffix ?? '').length > 0;

  return (
    <div className={className} style={style} {...htmlProps}>
      <div>
        {hasPrefix && <span>{value.prefix}</span>}
        <span>{value.text}</span>
        {hasSuffix && <span style={{ fontSize: fontSize * reductionFactor }}>{value.suffix}</span>}
      </div>
    </div>
  );
};

FormattedValueDisplay.displayName = 'FormattedDisplayValue';
