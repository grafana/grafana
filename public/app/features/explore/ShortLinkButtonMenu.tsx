import React, { useState } from 'react';

import { IconName } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { ToolbarButton, Dropdown, Menu, Stack, ToolbarButtonRow, MenuGroup } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { copyStringToClipboard } from 'app/core/utils/explore';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { useSelector } from 'app/types';

import { selectPanes } from './state/selectors';
import { constructAbsoluteUrl } from './utils/links';

export function ShortLinkButtonMenu() {
  const panes = useSelector(selectPanes);
  const [isOpen, setIsOpen] = useState(false);
  const onCopyLink = (shorten: boolean, url?: string) => {
    if (shorten) {
      createAndCopyShortLink(url || global.location.href);
      reportInteraction('grafana_explore_shortened_link_clicked');
    } else {
      copyStringToClipboard(url || global.location.href);
      reportInteraction('grafana_explore_copy_link_clicked');
    }
  };

  interface ShortLinkGroupData {
    key: string;
    label: string;
    items: ShortLinkMenuItemData[];
  }

  interface ShortLinkMenuItemData {
    key: string;
    label: string;
    icon: IconName;
    getUrl: Function;
    shorten: boolean;
  }

  const menuOptions: ShortLinkGroupData[] = [
    {
      key: 'normal',
      label: 'Normal Links (Share with normal or shortened URLs)',
      items: [
        {
          key: 'copy-shortened-link',
          icon: 'link',
          label: t('explore.toolbar.copy-shortened-link', 'Copy shortened link'),
          getUrl: () => undefined,
          shorten: true,
        },
        {
          key: 'copy-link',
          icon: 'link',
          label: t('explore.toolbar.copy-link', 'Copy link'),
          getUrl: () => undefined,
          shorten: false,
        },
      ],
    },
    {
      key: 'timesync',
      label: 'Time-Sync (Share with time range intact)',
      items: [
        {
          key: 'copy-short-link-abs-time',
          icon: 'clock-nine',
          label: t('explore.toolbar.copy-shortened-link-abs-time', 'Copy Absolute Shortened URL'),
          shorten: true,
          getUrl: () => {
            return constructAbsoluteUrl(panes);
          },
        },
        {
          key: 'copy-link-abs-time',
          icon: 'clock-nine',
          label: t('explore.toolbar.copy-link-abs-time', 'Copy Absolute Shortened URL'),
          shorten: false,
          getUrl: () => {
            return constructAbsoluteUrl(panes);
          },
        },
      ],
    },
  ];

  const MenuActions = () => {
    return (
      <Menu>
        {menuOptions.map((groupOption) => {
          return (
            <MenuGroup key={groupOption.key} label={groupOption.label}>
              {groupOption.items.map((option) => {
                return (
                  <Menu.Item
                    key={option.key}
                    label={option.label}
                    onClick={() => {
                      const url = option.getUrl();
                      onCopyLink(option.shorten, url);
                    }}
                  />
                );
              })}
            </MenuGroup>
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
      shorten: true,
    };
    return defaultMode;
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
            onCopyLink(buttonMode.shorten, url);
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
