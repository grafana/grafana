import { cx } from '@emotion/css';
import { memo } from 'react';

import { clearButtonStyles } from '../Button/Button';
import { FormattedValueDisplay } from '../FormattedValueDisplay/FormattedValueDisplay';

import { buildLayout } from './BigValueLayout';
import { BigValueJustifyMode, type Props } from './BigValueTypes';
import { PercentChange } from './PercentChange';

/**
 * Component for showing a value based on a [DisplayValue](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/displayValue.ts#L5).
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/plugins-bigvalue--docs
 */
export const BigValue = memo<Props>((props) => {
  const { onClick, className, hasLinks, theme, justifyMode = BigValueJustifyMode.Auto } = props;

  const layout = buildLayout({ ...props, justifyMode });
  const panelStyles = layout.getPanelStyles();
  const valueAndTitleContainerStyles = layout.getValueAndTitleContainerStyles();
  const valueStyles = layout.getValueStyles();
  const titleStyles = layout.getTitleStyles();
  const textValues = layout.textValues;
  const percentChange = props.value.percentChange;
  const percentChangeColorMode = props.percentChangeColorMode;
  const showPercentChange = percentChange != null && !Number.isNaN(percentChange);

  // When there is an outer data link this tooltip will override the outer native tooltip
  const tooltip = hasLinks ? undefined : textValues.tooltip;

  if (!onClick) {
    return (
      <div className={className} style={panelStyles} title={tooltip}>
        <div style={valueAndTitleContainerStyles}>
          {textValues.title && <div style={titleStyles}>{textValues.title}</div>}
          <FormattedValueDisplay value={textValues} style={valueStyles} />
          {showPercentChange && (
            <PercentChange
              percentChange={percentChange}
              styles={layout.getPercentChangeStyles(percentChange, percentChangeColorMode, valueStyles)}
            />
          )}
        </div>
        {layout.renderChart()}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cx(clearButtonStyles(theme), className)}
      style={panelStyles}
      onClick={onClick}
      title={tooltip}
    >
      <div style={valueAndTitleContainerStyles}>
        {textValues.title && <div style={titleStyles}>{textValues.title}</div>}
        <FormattedValueDisplay value={textValues} style={valueStyles} />
      </div>
      {layout.renderChart()}
    </button>
  );
});

BigValue.displayName = 'BigValue';
