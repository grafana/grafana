import { CSSProperties, HTMLProps } from 'react';

import { FormattedValue } from '@grafana/data';

export interface Props extends Omit<HTMLProps<HTMLDivElement>, 'className' | 'value' | 'style'> {
  value: FormattedValue;
  className?: string;
  style?: CSSProperties;
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

/**
 * Used to display a value, which also supports prefix and suffix.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/plugins-formattedvaluedisplay--docs
 */
export const FormattedValueDisplay = ({ value, className, style, ...htmlProps }: Props) => {
  const hasPrefix = (value.prefix ?? '').length > 0;
  const hasSuffix = (value.suffix ?? '').length > 0;
  let suffixStyle;

  if (style && typeof style.fontSize === 'number' && !Number.isNaN(style.fontSize)) {
    const fontSize = style.fontSize;
    const reductionFactor = fontSizeReductionFactor(fontSize);
    suffixStyle = { fontSize: fontSize * reductionFactor };
  }

  return (
    <div className={className} style={style} {...htmlProps}>
      <div>
        {hasPrefix && <span>{value.prefix}</span>}
        <span>{value.text}</span>
        {hasSuffix && <span style={suffixStyle}>{value.suffix}</span>}
      </div>
    </div>
  );
};

FormattedValueDisplay.displayName = 'FormattedDisplayValue';
