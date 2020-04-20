import React, { useState, FC } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, Icon, stylesFactory } from '@grafana/ui';

interface Props {
  title?: React.ReactNode;
  renderTitle?: (isExpanded: boolean) => React.ReactNode;
  defaultToClosed?: boolean;
  className?: string;
  nested?: boolean;
}

export const OptionsGroup: FC<Props> = ({
  title,
  children,
  defaultToClosed,
  renderTitle,
  className,
  nested = false,
}) => {
  const [isExpanded, toggleExpand] = useState(defaultToClosed ? false : true);
  const theme = useTheme();
  const styles = getStyles(theme, isExpanded, nested);

  return (
    <div className={cx(styles.box, className, 'options-group')}>
      <div className={styles.header} onClick={() => toggleExpand(!isExpanded)}>
        <div className={cx(styles.toggle, 'editor-options-group-toggle')}>
          <Icon name={isExpanded ? 'angle-down' : 'angle-right'} />
        </div>
        <div style={{ width: '100%' }}>{renderTitle ? renderTitle(isExpanded) : title}</div>
      </div>
      {isExpanded && <div className={styles.body}>{children}</div>}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme, isExpanded: boolean, isNested: boolean) => {
  return {
    box: cx(
      !isNested &&
        css`
          border-bottom: 1px solid ${theme.colors.pageHeaderBorder};
        `,
      isNested &&
        isExpanded &&
        css`
          margin-bottom: ${theme.spacing.formSpacingBase * 2}px;
        `
    ),
    toggle: css`
      color: ${theme.colors.textWeak};
      font-size: ${theme.typography.size.lg};
      margin-right: ${theme.spacing.sm};
    `,
    header: cx(
      css`
        display: flex;
        cursor: pointer;
        align-items: baseline;
        padding: ${theme.spacing.sm} ${theme.spacing.md} ${theme.spacing.sm} ${theme.spacing.sm};
        color: ${isExpanded ? theme.colors.text : theme.colors.formLabel};
        font-weight: ${theme.typography.weight.semibold};

        &:hover {
          color: ${theme.colors.text};

          .editor-options-group-toggle {
            color: ${theme.colors.text};
          }
        }
      `,
      isNested &&
        css`
          padding-left: 0;
          padding-right: 0;
          padding-top: 0;
        `
    ),
    body: cx(
      css`
        padding: 0 ${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.xl};
      `,
      isNested &&
        css`
          position: relative;
          padding-right: 0;
          &:before {
            content: '';
            position: absolute;
            top: 0;
            left: 8px;
            width: 1px;
            height: 100%;
            background: ${theme.colors.pageHeaderBorder};
          }
        `
    ),
  };
});
