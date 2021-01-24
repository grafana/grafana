import React, { FC, ReactNode } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useStyles } from '../../themes/ThemeContext';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';
import { styleMixins } from '../../themes';

export interface Props {
  pageIcon?: IconName;
  title: string;
  parent?: string;
  onGoBack?: () => void;
  onClickTitle?: () => void;
  onClickParent?: () => void;
  leftItems?: ReactNode[];
  children?: ReactNode;
}

/** @alpha */
export const PageToolbar: FC<Props> = React.memo((props) => {
  const { title, parent, pageIcon, children, onClickTitle, onClickParent, leftItems } = props;
  const styles = useStyles(getStyles);

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <div className={styles.pageIcon}>{pageIcon && <Icon name={pageIcon} size="lg" />}</div>
        <div className={styles.titleWrapper}>
          {parent && onClickParent && (
            <a onClick={props.onClickParent} className={cx(styles.titleLink, styles.parentLink)}>
              {parent} <span className={styles.parentIcon}>/</span>
            </a>
          )}
          {onClickTitle && (
            <a onClick={props.onClickTitle} className={styles.titleLink}>
              {title}
            </a>
          )}
          {!onClickTitle && <div className={styles.titleText}>{title}</div>}
        </div>
        {leftItems &&
          leftItems.map((child, index) => (
            <div className={styles.leftActionItem} key={index}>
              {child}
            </div>
          ))}
      </div>
      <div className={styles.spacer}></div>
      {React.Children.toArray(children)
        .filter(Boolean)
        .map((child, index) => {
          return (
            <div className={styles.actionWrapper} key={index}>
              {child}
            </div>
          );
        })}
    </div>
  );
});

PageToolbar.displayName = 'PageToolbar';

const getStyles = (theme: GrafanaTheme) => {
  const { spacing, typography } = theme;

  const titleStyles = `
      font-size: ${typography.size.lg};
      padding-left: ${spacing.sm};
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      width: 100%;
  `;

  return {
    toolbar: css`
      display: flex;
      background: ${theme.colors.dashboardBg};
      padding: 0 ${spacing.sm} ${spacing.sm} ${spacing.sm};
      justify-content: flex-end;
      flex-wrap: wrap;
    `,
    toolbarLeft: css`
      display: flex;
      overflow: hidden;
      flex-grow: 1;
    `,
    spacer: css`
      flex-grow: 1;
    `,
    pageIcon: css`
      display: flex;
      padding-top: ${spacing.sm};
      align-items: center;
    `,
    titleWrapper: css`
      display: flex;
      overflow: hidden;
      padding-top: ${spacing.sm};
      align-items: center;
    `,
    parentIcon: css`
      margin: 0 4px;
    `,
    titleText: css`
      ${titleStyles};
    `,
    titleLink: css`
      ${titleStyles};
    `,
    parentLink: css`
      display: none;

      @media ${styleMixins.mediaUp(theme.breakpoints.md)} {
        display: inline-block;
      }
    `,
    actionWrapper: css`
      padding-left: ${spacing.sm};
      padding-top: ${spacing.sm};
    `,
    leftActionItem: css`
      display: flex;
      height: 40px;
      position: relative;
      top: 4px;
      align-items: center;
      padding-left: ${spacing.md};
    `,
  };
};
