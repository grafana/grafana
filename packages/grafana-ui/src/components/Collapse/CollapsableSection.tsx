import React, { FC, ReactNode, useState } from 'react';
import { css } from 'emotion';
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

  return (
    <div>
      <div onClick={() => toggleOpen(!open)} className={styles.header}>
        {label}
        <Icon name={open ? 'angle-down' : 'angle-right'} size="xl" />
      </div>
      {open && <div className={styles.content}>{children}</div>}
    </div>
  );
};

const collapsableSectionStyles = (theme: GrafanaTheme) => {
  return {
    header: css`
      font-size: ${theme.typography.size.lg};
      cursor: pointer;
    `,
    content: css`
      padding: ${theme.spacing.md} 0;
    `,
  };
};
