import React, { FC, ReactNode, useState } from 'react';
import { css, cx } from 'emotion';
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
  const headerClass = cx({
    [styles.header]: true,
    [styles.headerCollapsed]: !open,
  });

  const tooltip = `Click to ${open ? 'collapse' : 'expand'}`;

  return (
    <div>
      <div onClick={() => toggleOpen(!open)} className={headerClass} title={tooltip}>
        {label}
        <Icon name={open ? 'angle-down' : 'angle-right'} size="xl" className={styles.icon} />
      </div>
      {open && <div className={styles.content}>{children}</div>}
    </div>
  );
};

const collapsableSectionStyles = (theme: GrafanaTheme) => {
  return {
    header: css`
      display: flex;
      justify-content: space-between;
      font-size: ${theme.typography.size.lg};
      cursor: pointer;
    `,
    headerCollapsed: css`
      border-bottom: 1px solid ${theme.colors.border2};
    `,
    icon: css`
      color: ${theme.colors.textWeak};
    `,
    content: css`
      padding: ${theme.spacing.md} 0;
    `,
  };
};
