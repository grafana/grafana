import { css } from '@emotion/css';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { contextSrv } from 'app/core/services/context_srv';

import { useProfileMenu } from '../TopBar/useProfileMenu';

interface Props {
  profileNode: NavModelItem;
}

/** The signed-in user at the bottom of the menu, opening their profile menu. */
export function MegaMenuProfile({ profileNode }: Props) {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const { renderMenu, drawers } = useProfileMenu({ profileNode, onToggleKioskMode: chrome.onToggleKioskMode });
  const { name, login, orgName, gravatarUrl } = contextSrv.user;

  return (
    <>
      <Dropdown overlay={renderMenu} placement="top-start">
        <button type="button" className={styles.trigger}>
          {gravatarUrl ? (
            <img className={styles.avatar} src={gravatarUrl} alt="" />
          ) : (
            <Icon name="user" size="lg" className={styles.avatar} />
          )}
          {/* Names the button as the profile, as the top bar button did, ahead of the user it belongs to. */}
          <span className="sr-only">{t('navigation.profile.aria-label', 'Profile')}</span>{' '}
          <span className={styles.identity}>
            <span className={styles.name}>{name || login}</span>
            {orgName && (
              <>
                <span aria-hidden> · </span>
                <span className={styles.org}>{orgName}</span>
              </>
            )}
          </span>
          <Icon name="angle-down" className={styles.chevron} />
        </button>
      </Dropdown>
      {drawers}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  trigger: css({
    alignItems: 'center',
    background: 'none',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    display: 'flex',
    flexShrink: 0,
    gap: theme.spacing(1),
    height: theme.spacing(5),
    margin: theme.spacing(0, 1, 1),
    padding: theme.spacing(0, 1),
    textAlign: 'left',
    '&:hover': {
      backgroundColor: theme.colors.action.hover,
    },
    '&:focus-visible': getFocusStyles(theme),
  }),
  avatar: css({
    borderRadius: theme.shape.radius.circle,
    flexShrink: 0,
    height: 24,
    width: 24,
  }),
  identity: css({
    color: theme.colors.text.secondary,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  name: css({
    color: theme.colors.text.primary,
  }),
  org: css({
    color: theme.colors.text.secondary,
  }),
  chevron: css({
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
});
