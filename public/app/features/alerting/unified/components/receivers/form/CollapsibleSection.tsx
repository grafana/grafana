import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

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
      <div className={styles.heading} onClick={toggleCollapse}>
        <CollapseToggle className={styles.caret} size={size} onToggle={toggleCollapse} isCollapsed={isCollapsed} />
        <h6>{label}</h6>
      </div>
      {description && <p className={styles.description}>{description}</p>}
      <div className={isCollapsed ? styles.hidden : undefined}>{children}</div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    margin-top: ${theme.spacing(1)};
    padding-bottom: ${theme.spacing(1)};
  `,
  caret: css`
    margin-left: -${theme.spacing(0.5)}; // make it align with fields despite icon size
  `,
  heading: css`
    cursor: pointer;
    h6 {
      display: inline-block;
    }
  `,
  hidden: css`
    display: none;
  `,
  description: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.size.sm};
    font-weight: ${theme.typography.fontWeightRegular};
    margin: 0;
  `,
});
