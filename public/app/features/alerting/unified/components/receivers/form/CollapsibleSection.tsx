import { css, cx } from '@emotion/css';
import { useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconSize, useStyles2 } from '@grafana/ui';

import { CollapseToggle } from '../../CollapseToggle';

interface Props {
  label: string;
  description?: string;
  className?: string;
  size?: IconSize;
}

export const CollapsibleSection = ({
  label,
  description,
  children,
  className,
  size = 'xl',
}: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className={cx(styles.wrapper, className)}>
      <CollapseToggle
        className={styles.toggle}
        size={size}
        onToggle={toggleCollapse}
        isCollapsed={isCollapsed}
        text={label}
      />
      {description && <p className={styles.description}>{description}</p>}
      <div className={isCollapsed ? styles.hidden : styles.content}>{children}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    marginTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  }),
  toggle: css({
    margin: theme.spacing(1, 0),
    padding: 0,
  }),
  hidden: css({
    display: 'none',
  }),
  description: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.fontWeightRegular,
    margin: 0,
  }),
  content: css({
    paddingLeft: theme.spacing(3),
  }),
});
