import { css, cx } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { Icon, Link, useTheme2 } from '@grafana/ui';

export interface Props {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  target?: HTMLAnchorElement['target'];
  url: string;
  id?: string;
  onPin: (id?: string) => void;
  isPinned?: boolean;
}

export function MegaMenuItemText({ children, isActive, onClick, target, url, id, onPin, isPinned }: Props) {
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
      {config.featureToggles.pinNavItems && (
        <Icon
          name="bookmark"
          type={isPinned ? 'solid' : 'default'}
          className={'pin-icon'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPin(id);
          }}
        />
      )}
    </div>
  );

  return (
    <LinkComponent
      data-testid={selectors.components.NavMenu.item}
      className={cx(styles.container, {
        [styles.containerActive]: isActive,
      })}
      href={url}
      target={target}
      onClick={onClick}
      {...(isActive && { 'aria-current': 'page' })}
    >
      {linkContent}
    </LinkComponent>
  );
}

MegaMenuItemText.displayName = 'MegaMenuItemText';

const getStyles = (theme: GrafanaTheme2, isActive: Props['isActive']) => ({
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
  containerActive: css({
    backgroundColor: theme.colors.background.secondary,
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
  linkContent: css({
    alignItems: 'center',
    display: 'flex',
    gap: '0.5rem',
    height: '100%',
    width: '100%',
    justifyContent: 'space-between',
    '.pin-icon': {
      display: 'none',
      padding: theme.spacing(0.5),
      width: theme.spacing(3),
      height: theme.spacing(3),
    },
    '&:hover': {
      '.pin-icon': {
        display: 'block',
      },
    },
  }),
});
