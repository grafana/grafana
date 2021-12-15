import React, { HTMLAttributes } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { styleMixins, stylesFactory, useTheme2 } from '../../themes';

/**
 * @public
 */
export interface CardContainerProps extends HTMLAttributes<HTMLOrSVGElement> {
  /** Disable pointer events for the Card, e.g. click events */
  disableEvents?: boolean;
  /** No style change on hover */
  disableHover?: boolean;
  /** Custom container styles */
  className?: string;
}

export const CardContainer = ({ children, disableEvents, disableHover, className, ...props }: CardContainerProps) => {
  const theme = useTheme2();
  const { container } = getCardContainerStyles(theme, disableEvents, disableHover);
  return (
    <div {...props} className={cx(container, className)}>
      {children}
    </div>
  );
};

const getCardContainerStyles = stylesFactory((theme: GrafanaTheme2, disabled = false, disableHover = false) => {
  return {
    container: css({
      display: 'grid',
      position: 'relative',
      gridTemplateColumns: 'auto 1fr auto',
      gridTemplateRows: '1fr auto auto auto',
      gridAutoColumns: '1fr',
      gridAutoFlow: 'row',
      gridTemplateAreas: `
        "Figure Heading Tags"
        "Figure Meta Tags"
        "Figure Description Tags"
        "Figure Actions Secondary"`,
      width: '100%',
      padding: theme.spacing(2),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(),

      pointerEvents: disabled ? 'none' : 'auto',
      transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
        duration: theme.transitions.duration.short,
      }),

      ...(!disableHover && {
        '&:hover': {
          background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
          cursor: 'pointer',
          zIndex: 1,
        },
        '&:focus': styleMixins.getFocusStyles(theme),
      }),
    }),
  };
});
