import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Icon, IconButton, Link, useTheme2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';

export interface Props {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  target?: HTMLAnchorElement['target'];
  url: string;
  onPin: (id?: string) => void;
  isPinned?: boolean;
}

export function MegaMenuItemText({ children, isActive, onClick, target, url, onPin, isPinned }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme, isActive);
  const LinkComponent = !target && url.startsWith('/') ? Link : 'a';

  const linkContent = (
    <div className={styles.linkContent}>
      {children}

      {
        // As nav links are supposed to link to internal urls this option should be used with caution
        target === '_blank' && <Icon data-testid="external-link-icon" name="external-link-alt" />
      }
    </div>
  );

  return (
    <div
      className={cx(styles.wrapper, {
        [styles.wrapperActive]: isActive,
        [styles.wrapperBookmark]: config.featureToggles.pinNavItems,
      })}
    >
      <LinkComponent
        data-testid={selectors.components.NavMenu.item}
        className={styles.container}
        href={url}
        target={target}
        onClick={onClick}
        {...(isActive && { 'aria-current': 'page' })}
      >
        {linkContent}
      </LinkComponent>
      {config.featureToggles.pinNavItems && contextSrv.isSignedIn && url && url !== '/bookmarks' && (
        <IconButton
          name="bookmark"
          className={'pin-icon'}
          iconType={isPinned ? 'solid' : 'default'}
          onClick={() => onPin(url)}
          aria-label={
            isPinned
              ? t('navigation.item.remove-bookmark', 'Remove from Bookmarks')
              : t('navigation.item.add-bookmark', 'Add to Bookmarks')
          }
        />
      )}
    </div>
  );
}

MegaMenuItemText.displayName = 'MegaMenuItemText';

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive']) => ({
  wrapper: css({
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    height: '100%',
  }),
  wrapperBookmark: css({
    '.pin-icon': {
      visibility: 'hidden',
    },
    '&:hover, &:focus-within': {
      a: {
        width: 'calc(100% - 20px)',
      },
      '.pin-icon': {
        visibility: 'visible',
      },
    },
  }),
  wrapperActive: css({
    backgroundColor: theme.colors.action.selected,
    borderTopRightRadius: theme.shape.radius.default,
    borderBottomRightRadius: theme.shape.radius.default,
    position: 'relative',

    '&::before': {
      backgroundImage: theme.colors.gradients.brandVertical,
      borderRadius: theme.shape.radius.default,
      content: '" "',
      display: 'block',
      height: '100%',
      position: 'absolute',
      transform: 'translateX(-50%)',
      width: theme.spacing(0.5),
    },
  }),
  container: css({
    alignItems: 'center',
    color: isActive ? theme.colors.text.primary : theme.colors.text.secondary,
    height: '100%',
    position: 'relative',
    width: '100%',

    '&:hover, &:focus-visible': {
      color: theme.colors.text.primary,
      textDecoration: 'underline',
    },

    '&:focus-visible': {
      boxShadow: 'none',
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '-2px',
      transition: 'none',
    },
  }),
  linkContent: css({
    alignItems: 'center',
    display: 'flex',
    gap: '0.5rem',
    height: '100%',
    width: '100%',
    justifyContent: 'space-between',
  }),
});
