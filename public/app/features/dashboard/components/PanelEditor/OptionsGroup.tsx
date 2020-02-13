import React, { useState, FC } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, Icon, stylesFactory } from '@grafana/ui';

interface Props {
  title: string;
}

export const OptionsGroup: FC<Props> = ({ title, children }) => {
  const [isExpanded, toggleExpand] = useState(true);
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.box}>
      <div className={styles.header} onClick={() => toggleExpand(!isExpanded)}>
        {title}
        <div className={styles.toggle}>
          <Icon name={isExpanded ? 'chevron-down' : 'chevron-left'} />
        </div>
      </div>
      {isExpanded && <div className={styles.body}>{children}</div>}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    box: css`
      border-bottom: 1px solid ${theme.colors.pageHeaderBorder};
    `,
    toggle: css`
      font-size: ${theme.typography.size.lg};
    `,
    header: css`
      display: flex;
      cursor: pointer;
      justify-content: space-between;
      align-items: center;
      padding: ${theme.spacing.sm} ${theme.spacing.md};
      font-weight: ${theme.typography.weight.semibold};
    `,
    body: css`
      padding: ${theme.spacing.md};
    `,
  };
});
