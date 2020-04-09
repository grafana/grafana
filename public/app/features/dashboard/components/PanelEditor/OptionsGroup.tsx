import React, { useState, FC } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, Icon, stylesFactory } from '@grafana/ui';

interface Props {
  title: string;
  defaultToClosed?: boolean;
}

export const OptionsGroup: FC<Props> = ({ title, children, defaultToClosed }) => {
  const [isExpanded, toggleExpand] = useState(defaultToClosed ? false : true);
  const theme = useTheme();
  const styles = getStyles(theme, isExpanded);

  return (
    <div className={styles.box}>
      <div className={styles.header} onClick={() => toggleExpand(!isExpanded)}>
        {title}
        <div className={cx(styles.toggle, 'editor-options-group-toggle')}>
          <Icon name={isExpanded ? 'angle-down' : 'angle-left'} />
        </div>
      </div>
      {isExpanded && <div className={styles.body}>{children}</div>}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme, isExpanded: boolean) => {
  return {
    box: css`
      border-bottom: 1px solid ${theme.colors.pageHeaderBorder};
    `,
    toggle: css`
      color: ${theme.colors.textWeak};
      font-size: ${theme.typography.size.lg};
    `,
    header: css`
      display: flex;
      cursor: pointer;
      justify-content: space-between;
      align-items: center;
      padding: ${theme.spacing.sm} ${theme.spacing.md};
      color: ${isExpanded ? theme.colors.text : theme.colors.formLabel};
      font-weight: ${theme.typography.weight.semibold};

      &:hover {
        .editor-options-group-toggle {
          color: ${theme.colors.text};
        }
      }
    `,
    body: css`
      padding: 0 ${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.md};
    `,
  };
});
