import React, { CSSProperties, HTMLAttributes } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  direction?: CSSProperties['flexDirection'];
  alignItems?: CSSProperties['alignItems'];
  justifyContent?: CSSProperties['justifyContent'];
  wrap?: boolean;
  padding?: number;
  gap?: number;
}

export const FlexBox = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { alignItems, direction, justifyContent, wrap, gap, className, padding, children, ...otherProps } = props;
  const theme = useTheme2();
  const styles = useStyles(theme, props);

  return (
    <div ref={ref} className={cx(styles.root, className)} {...otherProps}>
      {children}
    </div>
  );
});

FlexBox.displayName = 'FlexBox';

const useStyles = stylesFactory((theme: GrafanaTheme2, props: Props) => ({
  root: css({
    display: 'flex',
    flexDirection: props.direction ?? 'row',
    flexWrap: props.wrap ?? true ? 'wrap' : undefined,
    alignItems: props.alignItems,
    justifyContent: props.justifyContent,
    padding: props.padding ? theme.spacing(props.padding) : undefined,
    gap: theme.spacing(props.gap ?? 2),
  }),
}));
