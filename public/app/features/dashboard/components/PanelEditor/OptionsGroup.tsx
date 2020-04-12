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
        <div className={cx(styles.toggle, 'editor-options-group-toggle')}>
          <Icon name={isExpanded ? 'angle-down' : 'angle-right'} />
        </div>
        {title}
      </div>
      {isExpanded && <div className={styles.body}>{children}</div>}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme, isExpanded: boolean) => {
  return {
    box: css`
      border-bottom: 1px solid ${theme.palette.pageHeaderBorder};
    `,
    toggle: css`
      color: ${theme.palette.textWeak};
      font-size: ${theme.typography.size.lg};
      margin-right: ${theme.spacing.sm};
    `,
    header: css`
      display: flex;
      cursor: pointer;
      align-items: baseline;
      padding: ${theme.spacing.sm} ${theme.spacing.md} ${theme.spacing.sm} ${theme.spacing.sm};
      color: ${isExpanded ? theme.palette.text : theme.palette.formLabel};
      font-weight: ${theme.typography.weight.semibold};

      &:hover {
        .editor-options-group-toggle {
          color: ${theme.palette.text};
        }
      }
    `,
    body: css`
      padding: 0 ${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.xl};
    `,
  };
});
