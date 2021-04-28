import React, { FC, ReactNode, useState } from 'react';
import { css } from '@emotion/css';
import { useStyles2 } from '../../themes';
import { Icon } from '..';
import { GrafanaThemeV2 } from '@grafana/data';

export interface Props {
  label: string;
  isOpen: boolean;
  children: ReactNode;
}

export const CollapsableSection: FC<Props> = ({ label, isOpen, children }) => {
  const [open, toggleOpen] = useState<boolean>(isOpen);
  const styles = useStyles2(collapsableSectionStyles);
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

const collapsableSectionStyles = (theme: GrafanaThemeV2) => {
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
