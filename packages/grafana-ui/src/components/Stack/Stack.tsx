import { css } from '@emotion/css';
import React, { CSSProperties, useCallback } from 'react';

import { GrafanaTheme2, ThemeSpacingTokens } from '@grafana/data';

import { useStyles2 } from '../../themes';

interface StackProps {
  direction?: CSSProperties['flexDirection'];
  alignItems?: CSSProperties['alignItems'];
  wrap?: boolean;
  gap?: ThemeSpacingTokens;
  flexGrow?: CSSProperties['flexGrow'];
}

const Stack = React.forwardRef<HTMLDivElement, React.PropsWithChildren<StackProps>>((props, ref) => {
  const styles = useStyles2(useCallback((theme) => getStyles(theme, props), [props]));
  return (
    <div ref={ref} className={styles.root}>
      {props.children}
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2, props: StackProps) => ({
  root: css({
    display: 'flex',
    flexDirection: props.direction ?? 'row',
    flexWrap: props.wrap ?? true ? 'wrap' : undefined,
    alignItems: props.alignItems,
    gap: theme.spacing(props.gap ?? 2),
    flexGrow: props.flexGrow,
  }),
});

Stack.displayName = 'Stack';
export { Stack };
