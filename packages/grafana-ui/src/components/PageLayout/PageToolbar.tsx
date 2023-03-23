import { css, cx } from '@emotion/css';
import React, { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { Link, ToolbarButtonRow } from '..';
import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';

export interface Props {
  pageIcon?: IconName;
  title?: string;
  section?: string;
  parent?: string;
  onGoBack?: () => void;
  titleHref?: string;
  parentHref?: string;
  leftItems?: ReactNode[];
  children?: ReactNode;
  className?: string;
  isFullscreen?: boolean;
  'aria-label'?: string;
  buttonOverflowAlignment?: 'left' | 'right';
}

/** @alpha */
export const PageToolbar = React.memo(
  ({
    title,
    section,
    parent,
    pageIcon,
    onGoBack,
    children,
    titleHref,
    parentHref,
    leftItems,
    isFullscreen,
    className,
    /** main nav-container aria-label **/
    'aria-label': ariaLabel,
    buttonOverflowAlignment = 'right',
  }: Props) => {
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
        [styles.noPageIcon]: !pageIcon,
      },
      className
    );

    const titleEl = (
      <>
        <span className={styles.truncateText}>{title}</span>
        {section && <span className={styles.pre}> / {section}</span>}
      </>
    );

    return (
      <nav className={mainStyle} aria-label={ariaLabel}>
        <div className={styles.leftWrapper}>
          {pageIcon && !onGoBack && (
            <div className={styles.pageIcon}>
              <Icon name={pageIcon} size="lg" aria-hidden />
            </div>
          )}
          {onGoBack && (
            <div className={styles.pageIcon}>
              <IconButton
                name="arrow-left"
                tooltip="Go back (Esc)"
                tooltipPlacement="bottom"
                size="xxl"
                aria-label={selectors.components.BackButton.backArrow}
                onClick={onGoBack}
              />
            </div>
          )}
          <nav aria-label="Search links" className={styles.navElement}>
            {parent && parentHref && (
              <>
                <Link
                  aria-label={`Search dashboard in the ${parent} folder`}
                  className={cx(styles.titleText, styles.parentLink, styles.titleLink, styles.truncateText)}
                  href={parentHref}
                >
                  {parent} <span className={styles.parentIcon}></span>
                </Link>
                {titleHref && (
                  <span className={cx(styles.titleText, styles.titleDivider)} aria-hidden>
                    /
                  </span>
                )}
              </>
            )}

            {(title || Boolean(leftItems?.length)) && (
              <div className={styles.titleWrapper}>
                {title && (
                  <h1 className={styles.h1Styles}>
                    {titleHref ? (
                      <Link
                        aria-label="Search dashboard by name"
                        className={cx(styles.titleText, styles.titleLink)}
                        href={titleHref}
                      >
                        {titleEl}
                      </Link>
                    ) : (
                      <div className={styles.titleText}>{titleEl}</div>
                    )}
                  </h1>
                )}

                {leftItems?.map((child, index) => (
                  <div className={styles.leftActionItem} key={index}>
                    {child}
                  </div>
                ))}
              </div>
            )}
          </nav>
        </div>
        <ToolbarButtonRow alignment={buttonOverflowAlignment}>
          {React.Children.toArray(children).filter(Boolean)}
        </ToolbarButtonRow>
      </nav>
    );
  }
);

PageToolbar.displayName = 'PageToolbar';

const getStyles = (theme: GrafanaTheme2) => {
  const { spacing, typography } = theme;

  const focusStyle = getFocusStyles(theme);

  return {
    pre: css`
      white-space: pre;
    `,
    toolbar: css`
      align-items: center;
      background: ${theme.colors.background.canvas};
      display: flex;
      gap: ${theme.spacing(2)};
      justify-content: space-between;
      padding: ${theme.spacing(1.5, 2)};

      ${theme.breakpoints.down('md')} {
        padding-left: 53px;
      }
    `,
    noPageIcon: css`
      ${theme.breakpoints.down('md')} {
        padding-left: ${theme.spacing(2)};
      }
    `,
    leftWrapper: css`
      display: flex;
      flex-wrap: nowrap;
      max-width: 70%;
    `,
    pageIcon: css`
      display: none;
      ${theme.breakpoints.up('sm')} {
        display: flex;
        padding-right: ${theme.spacing(1)};
        align-items: center;
      }
    `,
    truncateText: css`
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `,
    titleWrapper: css`
      display: flex;
      margin: 0;
      min-width: 0;
    `,
    navElement: css`
      display: flex;
      align-items: center;
      min-width: 0;
    `,
    h1Styles: css`
      margin: ${spacing(0, 1, 0, 0)};
      line-height: inherit;
      flex-grow: 1;
      min-width: 0;
    `,
    parentIcon: css`
      margin-left: ${theme.spacing(0.5)};
    `,
    titleText: css`
      display: flex;
      font-size: ${typography.size.lg};
      margin: 0;
      max-width: 300px;
      border-radius: ${theme.shape.radius.default};
    `,
    titleLink: css`
      &:focus-visible {
        ${focusStyle}
      }
    `,
    titleDivider: css`
      padding: ${spacing(0, 0.5, 0, 0.5)};
      display: none;
      ${theme.breakpoints.up('md')} {
        display: unset;
      }
    `,
    parentLink: css`
      display: none;
      ${theme.breakpoints.up('md')} {
        display: unset;
        flex: 1;
      }
    `,
    leftActionItem: css`
      display: none;
      ${theme.breakpoints.up('md')} {
        align-items: center;
        display: flex;
        padding-right: ${spacing(0.5)};
      }
    `,
  };
};
