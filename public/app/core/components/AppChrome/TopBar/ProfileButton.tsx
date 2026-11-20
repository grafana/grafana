import { css } from '@emotion/css';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, ToolbarButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

import { useProfileMenu } from './useProfileMenu';

export interface Props {
  profileNode: NavModelItem;
  onToggleKioskMode: () => void;
}

export function ProfileButton({ profileNode, onToggleKioskMode }: Props) {
  const styles = useStyles2(getStyles);
  const { renderMenu, drawers } = useProfileMenu({ profileNode, onToggleKioskMode });

  return (
    <>
      <Dropdown overlay={renderMenu} placement="bottom-end">
        <ToolbarButton
          className={styles.profileButton}
          imgSrc={contextSrv.user.gravatarUrl}
          imgAlt="User avatar"
          aria-label={t('navigation.profile.aria-label', 'Profile')}
        />
      </Dropdown>
      {drawers}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    profileButton: css({
      padding: theme.spacing(0, 0.5),
      img: {
        borderRadius: theme.shape.radius.circle,
        height: '24px',
        marginRight: 0,
        width: '24px',
      },
    }),
  };
};
