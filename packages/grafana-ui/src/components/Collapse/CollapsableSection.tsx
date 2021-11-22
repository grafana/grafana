import React, { FC, ReactNode, useState } from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { Icon } from '..';
import { GrafanaTheme2 } from '@grafana/data';

export interface Props {
  label: ReactNode;
  isOpen: boolean;
  /** Callback for the toggle functionality */
  onToggle?: (isOpen: boolean) => void;
  children: ReactNode;
}

export const CollapsableSection: FC<Props> = ({ label, isOpen, onToggle, children }) => {
  const [open, toggleOpen] = useState<boolean>(isOpen);
  const styles = useStyles2(collapsableSectionStyles);
  const headerStyle = open ? styles.header : styles.headerCollapsed;
  const tooltip = `Click to ${open ? 'collapse' : 'expand'}`;
  const onClick = () => {
    onToggle?.(!open);
    toggleOpen(!open);
  };

  return (
    <div>
      <div onClick={onClick} className={headerStyle} title={tooltip}>
        {label}
        <Icon name={open ? 'angle-down' : 'angle-right'} size="xl" className={styles.icon} />
      </div>
      {open && <div className={styles.content}>{children}</div>}
    </div>
  );
};

const collapsableSectionStyles = (theme: GrafanaTheme2) => {
  const header = css({
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: theme.typography.size.lg,
    padding: `${theme.spacing(0.5)} 0`,
    cursor: 'pointer',
  });
  const headerCollapsed = css(header, {
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  });
  const icon = css({
    color: theme.colors.text.secondary,
  });
  const content = css({
    padding: `${theme.spacing(2)} 0`,
  });

  return { header, headerCollapsed, icon, content };
};
