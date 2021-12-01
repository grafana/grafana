import React, { CSSProperties } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory, useTheme2 } from '@grafana/ui';

interface StackProps {
  direction?: CSSProperties['flexDirection'];
  alignItems?: CSSProperties['alignItems'];
  wrap?: boolean;
  gap?: number;
}

const Stack: React.FC<StackProps> = ({ children, ...props }) => {
  const theme = useTheme2();
  const styles = useStyles(theme, props);

  return <div className={styles.root}>{children}</div>;
};

const useStyles = stylesFactory((theme: GrafanaTheme2, props: StackProps) => ({
  root: css({
    display: 'flex',
    flexDirection: props.direction ?? 'row',
    flexWrap: props.wrap ?? true ? 'wrap' : undefined,
    alignItems: props.alignItems,
    gap: theme.spacing(props.gap ?? 2),
  }),
}));

export default Stack;
