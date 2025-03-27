import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { useToggle } from 'react-use';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Dropdown, Menu, MenuItem, ToolbarButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';

import { enrichWithInteractionTracking } from '../MegaMenu/utils';
import { NewsContainer } from '../News/NewsDrawer';

import { TopNavBarMenu } from './TopNavBarMenu';

export interface Props {
  profileNode: NavModelItem;
}

export function ProfileButton({ profileNode }: Props) {
  const styles = useStyles2(getStyles);
  const node = enrichWithInteractionTracking(cloneDeep(profileNode), false);
  const [showNewsDrawer, onToggleShowNewsDrawer] = useToggle(false);

  if (!node) {
    return null;
  }

  const renderMenu = () => (
    <TopNavBarMenu node={profileNode}>
      {config.newsFeedEnabled && (
        <>
          <Menu.Divider />
          <MenuItem
            icon="rss"
            onClick={onToggleShowNewsDrawer}
            label={t('navigation.rss-button', 'Latest from the blog')}
          />
        </>
      )}
    </TopNavBarMenu>
  );

  return (
    <>
      <Dropdown overlay={renderMenu} placement="bottom-end">
        <ToolbarButton
          className={styles.profileButton}
          imgSrc={contextSrv.user.gravatarUrl}
          imgAlt="User avatar"
          aria-label="Profile"
        />
      </Dropdown>
      {showNewsDrawer && <NewsContainer onClose={onToggleShowNewsDrawer} />}
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
