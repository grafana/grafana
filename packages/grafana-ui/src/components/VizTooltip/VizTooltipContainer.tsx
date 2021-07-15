import React, { useState, HTMLAttributes, useMemo } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { getTooltipContainerStyles } from '../../themes/mixins';
import { GrafanaTheme2 } from '@grafana/data';
import { usePopper } from 'react-popper';

/**
 * @public
 */
export interface VizTooltipContainerProps extends HTMLAttributes<HTMLDivElement> {
  position: { x: number; y: number };
  offset: { x: number; y: number };
  children?: React.ReactNode;
}

/**
 * @public
 */
export const VizTooltipContainer: React.FC<VizTooltipContainerProps> = ({
  position: { x: positionX, y: positionY },
  offset: { x: offsetX, y: offsetY },
  children,
  className,
  ...otherProps
}) => {
  const [tooltipRef, setTooltipRef] = useState<HTMLDivElement | null>(null);
  const virtualElement = useMemo(
    () => ({
      getBoundingClientRect() {
        return { top: positionY, left: positionX, bottom: positionY, right: positionX, width: 0, height: 0 };
      },
    }),
    [positionY, positionX]
  );
  const { styles: popperStyles, attributes } = usePopper(virtualElement, tooltipRef, {
    placement: 'bottom-start',
    modifiers: [
      { name: 'arrow', enabled: false },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {
          altAxis: true,
          rootBoundary: 'viewport',
        },
      },
      {
        name: 'offset',
        options: {
          offset: [offsetX, offsetY],
        },
      },
    ],
  });

  const styles = useStyles2(getStyles);

  return (
    <div
      ref={setTooltipRef}
      style={{
        ...popperStyles.popper,
        display: popperStyles.popper?.transform ? 'block' : 'none',
        transition: 'all ease-out 0.2s',
      }}
      {...attributes.popper}
      {...otherProps}
      className={cx(styles.wrapper, className)}
    >
      {children}
    </div>
  );
};

VizTooltipContainer.displayName = 'VizTooltipContainer';

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    ${getTooltipContainerStyles(theme)}
  `,
});
