import { css, cx } from '@emotion/css';
import { memo, Children, ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';
import { IconName } from '../../types/icon';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { Link } from '../Link/Link';
import { ToolbarButtonRow } from '../ToolbarButton/ToolbarButtonRow';

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
  /**
   * Forces left items to be visible on small screens.
   * By default left items are hidden on small screens.
   */
  forceShowLeftItems?: boolean;
}

/** @deprecated Use Page instead */
export const PageToolbar = memo(
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
    forceShowLeftItems = false,
  }: Props) => {
    const styles = useStyles2(getStyles);

    /**
     * .page-toolbar css class is used for some legacy css view modes (TV/Kiosk) and
     * media queries for mobile view when toolbar needs left padding to make room
     * for mobile menu icon. This logic hopefully can be changed when we move to a full react
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
        {section && (
          <span className={styles.pre}>
            {' / '}
            {section}
          </span>
        )}
      </>
    );

    const goBackLabel = t('grafana-ui.page-toolbar.go-back', 'Go back (Esc)');
    const searchParentFolderLabel = t(
      'grafana-ui.page-toolbar.search-parent-folder',
      'Search dashboard in the {{parent}} folder',
      { parent }
    );
    const searchDashboardNameLabel = t('grafana-ui.page-toolbar.search-dashboard-name', 'Search dashboard by name');
    const searchLinksLabel = t('grafana-ui.page-toolbar.search-links', 'Search links');

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
                tooltip={goBackLabel}
                tooltipPlacement="bottom"
                size="xxl"
                data-testid={selectors.components.BackButton.backArrow}
                onClick={onGoBack}
              />
            </div>
          )}
          <nav aria-label={searchLinksLabel} className={styles.navElement}>
            {parent && parentHref && (
              <>
                <Link
                  aria-label={searchParentFolderLabel}
                  className={cx(styles.titleText, styles.parentLink, styles.titleLink, styles.truncateText)}
                  href={parentHref}
                >
                  {parent} <span className={styles.parentIcon}></span>
                </Link>
                {titleHref && (
                  <span className={cx(styles.titleText, styles.titleDivider)} aria-hidden>
                    {'/'}
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
                        aria-label={searchDashboardNameLabel}
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
                  <div
                    className={cx(styles.leftActionItem, { [styles.forceShowLeftActionItems]: forceShowLeftItems })}
                    key={index}
                  >
                    {child}
                  </div>
                ))}
              </div>
            )}
          </nav>
        </div>
        <ToolbarButtonRow alignment={buttonOverflowAlignment}>
          {Children.toArray(children).filter(Boolean)}
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
    pre: css({
      whiteSpace: 'pre',
    }),
    toolbar: css({
      alignItems: 'center',
      background: theme.colors.background.canvas,
      display: 'flex',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
      padding: theme.spacing(1.5, 2),

      [theme.breakpoints.down('md')]: {
        paddingLeft: '53px',
      },
    }),
    noPageIcon: css({
      [theme.breakpoints.down('md')]: {
        paddingLeft: theme.spacing(2),
      },
    }),
    leftWrapper: css({
      display: 'flex',
      flexWrap: 'nowrap',
      maxWidth: '70%',
    }),
    pageIcon: css({
      display: 'none',
      [theme.breakpoints.up('sm')]: {
        display: 'flex',
        paddingRight: theme.spacing(1),
        alignItems: 'center',
      },
    }),
    truncateText: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    titleWrapper: css({
      display: 'flex',
      margin: 0,
      minWidth: 0,
    }),
    navElement: css({
      display: 'flex',
      alignItems: 'center',
      minWidth: 0,
    }),
    h1Styles: css({
      margin: spacing(0, 1, 0, 0),
      lineHeight: 'inherit',
      flexGrow: 1,
      minWidth: 0,
    }),
    parentIcon: css({
      marginLeft: theme.spacing(0.5),
    }),
    titleText: css({
      display: 'flex',
      fontSize: typography.size.lg,
      margin: 0,
      borderRadius: theme.shape.radius.default,
    }),
    titleLink: css({
      '&:focus-visible': focusStyle,
    }),
    titleDivider: css({
      padding: spacing(0, 0.5, 0, 0.5),
      display: 'none',
      [theme.breakpoints.up('md')]: {
        display: 'unset',
      },
    }),
    parentLink: css({
      display: 'none',
      [theme.breakpoints.up('md')]: {
        display: 'unset',
        flex: 1,
      },
    }),
    leftActionItem: css({
      display: 'none',
      alignItems: 'center',
      paddingRight: spacing(0.5),
      [theme.breakpoints.up('md')]: {
        display: 'flex',
      },
    }),
    forceShowLeftActionItems: css({
      display: 'flex',
    }),
  };
};
