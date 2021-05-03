import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import React, { FC, useState } from 'react';

interface Props {
  label: string;
}

export const CollapsibleSection: FC<Props> = ({ label, children }) => {
  const styles = useStyles2(getStyles);
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className={styles.wrapper}>
      <div className={styles.heading} onClick={toggleCollapse}>
        <Icon className={styles.caret} size="xl" name={isCollapsed ? 'angle-right' : 'angle-down'} />
        <h6>{label}</h6>
      </div>
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
});
