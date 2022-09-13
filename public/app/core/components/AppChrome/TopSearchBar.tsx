import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, NavSection } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Dropdown, FilterInput, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useSearchQuery } from 'app/features/search/hooks/useSearchQuery';
import { StoreState } from 'app/types';

import { enrichConfigItems, enrichWithInteractionTracking } from '../NavBar/utils';
import { OrgSwitcher } from '../OrgSwitcher';

import { TopNavBarMenu } from './TopBar/TopNavBarMenu';
import { TOP_BAR_LEVEL_HEIGHT } from './types';

export function TopSearchBar() {
  const styles = useStyles2(getStyles);
  const location = useLocation();
  const { query, onQueryChange } = useSearchQuery({});
  const navBarTree = useSelector((state: StoreState) => state.navBarTree);
  const navTree = cloneDeep(navBarTree);
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);
  const toggleSwitcherModal = () => {
    setShowSwitcherModal(!showSwitcherModal);
  };

  const onOpenSearch = () => {
    locationService.partial({ search: 'open' });
  };
  const onSearchChange = (value: string) => {
    onQueryChange(value);
    if (value) {
      onOpenSearch();
    }
  };

  const configItems = enrichConfigItems(
    navTree.filter((item) => item.section === NavSection.Config),
    location,
    toggleSwitcherModal
  ).map((item) => enrichWithInteractionTracking(item, false));

  const profileNode = configItems.find((item) => item.id === 'profile');
  const signInNode = configItems.find((item) => item.id === 'signin');

  return (
    <div className={styles.container}>
      <div className={styles.leftContent}>
        <a className={styles.logo} href="/" title="Go to home">
          <Icon name="grafana" size="xl" />
        </a>
      </div>
      <div className={styles.searchWrapper}>
        <FilterInput
          onClick={onOpenSearch}
          placeholder="Search Grafana"
          value={query.query ?? ''}
          onChange={onSearchChange}
          className={styles.searchInput}
        />
      </div>
      <div className={styles.actions}>
        <Tooltip placement="bottom" content="Help menu (todo)">
          <button className={styles.actionItem}>
            <Icon name="question-circle" size="lg" />
          </button>
        </Tooltip>
        <Tooltip placement="bottom" content="Grafana news (todo)">
          <button className={styles.actionItem}>
            <Icon name="rss" size="lg" />
          </button>
        </Tooltip>
        {signInNode && (
          <Tooltip placement="bottom" content="Sign in">
            <a className={styles.actionItem} href={signInNode.url} target={signInNode.target}>
              {signInNode.icon && <Icon name={signInNode.icon} size="lg" />}
            </a>
          </Tooltip>
        )}
        {profileNode && (
          <Dropdown overlay={<TopNavBarMenu node={profileNode} />}>
            <button className={styles.actionItem}>
              <img src={contextSrv.user.gravatarUrl} />
            </button>
          </Dropdown>
        )}
      </div>
      {showSwitcherModal && <OrgSwitcher onDismiss={toggleSwitcherModal} />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      height: TOP_BAR_LEVEL_HEIGHT,
      display: 'grid',
      gridTemplateColumns: '1fr 2fr 1fr',
      padding: theme.spacing(0, 2),
      alignItems: 'center',
      border: `1px solid ${theme.colors.border.weak}`,
    }),
    leftContent: css({
      display: 'flex',
    }),
    logo: css({
      display: 'flex',
    }),
    searchWrapper: css({}),
    searchInput: css({}),
    actions: css({
      display: 'flex',
      gap: theme.spacing(1),
      justifyContent: 'flex-end',
    }),
    actionItem: css({
      display: 'flex',
      flexGrow: 0,
      border: 'none',
      boxShadow: 'none',
      background: 'none',
      alignItems: 'center',

      color: theme.colors.text.secondary,
      '&:hover': {
        background: theme.colors.background.secondary,
      },
      img: {
        borderRadius: '50%',
        width: '24px',
        height: '24px',
      },
    }),
  };
};
