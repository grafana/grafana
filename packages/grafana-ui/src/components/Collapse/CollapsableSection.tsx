import React, { FC, ReactNode, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes';
import { Icon } from '..';

export interface Props {
  label: string;
  isOpen: boolean;
  children: ReactNode;
}

export const CollapsableSection: FC<Props> = ({ label, isOpen, children }) => {
  const [open, toggleOpen] = useState<boolean>(isOpen);
  const styles = useStyles(collapsableSectionStyles);
  const headerStyle = open ? styles.header : styles.headerCollapsed;
  const tooltip = `Click to ${open ? 'collapse' : 'expand'}`;

  return (
    <div>
      <div onClick={() => toggleOpen(!open)} className={headerStyle} title={tooltip}>
        {label}
        <Icon name={open ? 'angle-down' : 'angle-right'} size="xl" className={styles.icon} />
      </div>
      {open && <div className={styles.content}>{children}</div>}
    </div>
  );
};

const collapsableSectionStyles = (theme: GrafanaTheme) => {
  const header = css({
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: theme.typography.size.lg,
    padding: `${theme.spacing.xs} 0`,
    cursor: 'pointer',
  });
  const headerCollapsed = css(header, {
    borderBottom: `1px solid ${theme.colors.border2}`,
  });
  const icon = css({
    color: theme.colors.textWeak,
  });
  const content = css({
    padding: `${theme.spacing.md} 0`,
  });

  return { header, headerCollapsed, icon, content };
};
