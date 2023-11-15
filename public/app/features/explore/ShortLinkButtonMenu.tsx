import React, { useState } from 'react';

import { IconName, urlUtil, ExploreUrlState } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { ToolbarButton, Dropdown, Menu, Stack, ToolbarButtonRow } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import store from 'app/core/store';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { ExploreItemState, useSelector } from 'app/types';

import { getUrlStateFromPaneState } from './hooks/useStateSync';
import { selectPanes } from './state/selectors';

export function ShortLinkButtonMenu() {
  const panes = useSelector(selectPanes);
  const [isOpen, setIsOpen] = useState(false);
  const onCopyShortLink = (persistType?: string, url?: string) => {
    if (persistType !== undefined) {
      store.set('grafana.explore.shortLinkShareType', persistType);
    }
    createAndCopyShortLink(url || global.location.href);
    reportInteraction('grafana_explore_shortened_link_clicked');
  };

  interface ShortLinkMenuItemData {
    key: string;
    label: string;
    icon: IconName;
    getUrl: Function;
    description?: string;
  }

  type StateEntry = [string, ExploreItemState];
  const isStateEntry = (entry: [string, ExploreItemState | undefined]): entry is StateEntry => {
    return entry[1] !== undefined;
  };

  const menuOptions: ShortLinkMenuItemData[] = [
    {
      key: 'copy-link',
      label: t('explore.toolbar.copy-shortened-link', 'Copy shortened link'),
      icon: 'link',
      getUrl: () => undefined,
    },
    {
      key: 'copy-link-abs-time',
      label: t('explore.toolbar.copy-shortened-link-abs-time', 'Copy shortened link with absolute time'),
      icon: 'clock-nine',
      description: t(
        'explore.toolbar.copy-shortened-link-abs-time-desc',
        'Locks the current time for consistent viewing'
      ),
      getUrl: () => {
        const urlStates = Object.entries(panes)
          .filter(isStateEntry)
          .map(([exploreId, pane]) => {
            const urlState = getUrlStateFromPaneState(pane);
            urlState.range = {
              to: pane.range.to.valueOf().toString(),
              from: pane.range.from.valueOf().toString(),
            };
            const panes: [string, ExploreUrlState] = [exploreId, urlState];
            return panes;
          })
          .reduce((acc, [exploreId, urlState]) => {
            return { ...acc, [exploreId]: urlState };
          }, {});
        return urlUtil.renderUrl('/explore', { schemaVersion: 1, panes: JSON.stringify(urlStates) });
      },
    },
  ];

  const MenuActions = () => {
    return (
      <Menu>
        {menuOptions.map((option) => {
          return (
            <Menu.Item
              key={option.key}
              label={option.label}
              icon={option.icon}
              onClick={() => {
                const url = option.getUrl();
                onCopyShortLink(option.key, url);
              }}
              description={option.description}
            />
          );
        })}
      </Menu>
    );
  };

  const buttonMode = (() => {
    const defaultMode: ShortLinkMenuItemData = {
      key: 'copy-link',
      label: t('explore.toolbar.copy-shortened-link', 'Copy shortened link'),
      icon: 'share-alt',
      getUrl: () => undefined,
    };
    const savedModeKey = store.get('grafana.explore.shortLinkShareType');
    if (savedModeKey !== undefined) {
      const foundMode = menuOptions.find((option) => option.key === savedModeKey);
      return foundMode || defaultMode;
    } else {
      return defaultMode;
    }
  })();

  // we need the Toolbar button click to be an action separate from opening/closing the menu
  return (
    <ToolbarButtonRow>
      <Stack gap={0} direction="row" alignItems="center" wrap="nowrap">
        <ToolbarButton
          tooltip={buttonMode.label}
          icon={buttonMode.icon}
          iconOnly={true}
          narrow={true}
          onClick={() => {
            const url = buttonMode.getUrl();
            onCopyShortLink(buttonMode.key, url);
          }}
          aria-label={t('explore.toolbar.copy-shortened-link', 'Copy shortened link')}
        />
        <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
          <ToolbarButton
            narrow={true}
            isOpen={isOpen}
            aria-label={t('explore.toolbar.copy-shortened-link-menu', 'Open copy link options')}
          />
        </Dropdown>
      </Stack>
    </ToolbarButtonRow>
  );
}
