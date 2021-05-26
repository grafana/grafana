import React, { FC, ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '../../themes/ThemeContext';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';
import { styleMixins } from '../../themes';
import { IconButton } from '../IconButton/IconButton';
import { selectors } from '@grafana/e2e-selectors';

export interface Props {
  pageIcon?: IconName;
  title: string;
  parent?: string;
  onGoBack?: () => void;
  onClickTitle?: () => void;
  onClickParent?: () => void;
  leftItems?: ReactNode[];
  children?: ReactNode;
  className?: string;
  isFullscreen?: boolean;
}

/** @alpha */
export const PageToolbar: FC<Props> = React.memo(
  ({
    title,
    parent,
    pageIcon,
    onGoBack,
    children,
    onClickTitle,
    onClickParent,
    leftItems,
    isFullscreen,
    className,
  }) => {
    const styles = useStyles2(getStyles);

    /**
     * .page-toolbar css class is used for some legacy css view modes (TV/Kiosk) and
     * media queries for mobile view when toolbar needs left padding to make room
     * for mobile menu icon. This logic hopefylly can be changed when we move to a full react
     * app and change how the app side menu & mobile menu is rendered.
     */
    const mainStyle = cx(
      'page-toolbar',
      styles.toolbar,
      {
        ['page-toolbar--fullscreen']: isFullscreen,
      },
      className
    );

    return (
      <div className={mainStyle}>
        {pageIcon && !onGoBack && (
          <div className={styles.pageIcon}>
            <Icon name={pageIcon} size="lg" />
          </div>
        )}
        {onGoBack && (
          <div className={styles.pageIcon}>
            <IconButton
              name="arrow-left"
              tooltip="Go back (Esc)"
              tooltipPlacement="bottom"
              size="xxl"
              surface="dashboard"
              aria-label={selectors.components.BackButton.backArrow}
              onClick={onGoBack}
            />
          </div>
        )}
        {parent && onClickParent && (
          <button onClick={onClickParent} className={cx(styles.titleText, styles.parentLink)}>
            {parent} <span className={styles.parentIcon}>/</span>
          </button>
        )}
        {onClickTitle && (
          <button onClick={onClickTitle} className={styles.titleText}>
            {title}
          </button>
        )}
        {!onClickTitle && <div className={styles.titleText}>{title}</div>}
        {leftItems?.map((child, index) => (
          <div className={styles.leftActionItem} key={index}>
            {child}
          </div>
        ))}

        <div className={styles.spacer} />
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
  }
);

PageToolbar.displayName = 'PageToolbar';

const getStyles = (theme: GrafanaTheme2) => {
  const { spacing, typography } = theme;

  const titleStyles = `
      font-size: ${typography.size.lg};
      padding: ${spacing(0.5, 1, 0.5, 1)};
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
      max-width: 240px;

      // clear default button styles
      background: none;
      border: none;

      @media ${styleMixins.mediaUp(theme.v1.breakpoints.xl)} {
        max-width: unset;
      }
  `;

  return {
    toolbar: css`
      align-items: center;
      background: ${theme.colors.background.canvas};
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      padding: ${theme.spacing(1.5, 2)};
    `,
    spacer: css`
      flex-grow: 1;
    `,
    pageIcon: css`
      display: none;
      @media ${styleMixins.mediaUp(theme.v1.breakpoints.md)} {
        display: flex;
        align-items: center;
      }
    `,
    titleWrapper: css`
      display: flex;
      align-items: center;
      min-width: 0;
      overflow: hidden;
    `,
    parentIcon: css`
      margin-left: ${theme.spacing(0.5)};
    `,
    titleText: css`
      ${titleStyles};
    `,
    parentLink: css`
      display: none;
      padding-right: 0;
      @media ${styleMixins.mediaUp(theme.v1.breakpoints.md)} {
        display: unset;
      }
    `,
    actionWrapper: css`
      padding: ${spacing(0.5, 0, 0.5, 1)};
    `,
    leftActionItem: css`
      display: none;
      @media ${styleMixins.mediaUp(theme.v1.breakpoints.md)} {
        align-items: center;
        display: flex;
        padding-left: ${spacing(0.5)};
      }
    `,
  };
};
