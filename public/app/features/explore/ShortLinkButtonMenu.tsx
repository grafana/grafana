import { useState } from 'react';

import { IconName } from '@grafana/data';
import { reportInteraction, config } from '@grafana/runtime';
import { Dropdown, Menu, MenuGroup, ButtonGroup, Button } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { copyStringToClipboard } from 'app/core/utils/explore';
import { createAndCopyShortLink } from 'app/core/utils/shortLinks';
import { useSelector } from 'app/types';

import { selectPanes } from './state/selectors';
import { constructAbsoluteUrl } from './utils/links';

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
  absTime: boolean;
}

export function ShortLinkButtonMenu() {
  const defaultMode: ShortLinkMenuItemData = {
    key: 'copy-link',
    label: t('explore.toolbar.copy-shortened-link', 'Copy shortened URL'),
    icon: 'share-alt',
    getUrl: () => undefined,
    shorten: true,
    absTime: false,
  };
  const panes = useSelector(selectPanes);
  const [isOpen, setIsOpen] = useState(false);
  const [lastSelected, setLastSelected] = useState(defaultMode);
  const onCopyLink = (shorten: boolean, absTime: boolean, url?: string) => {
    if (shorten) {
      createAndCopyShortLink(url || global.location.href);
      reportInteraction('grafana_explore_shortened_link_clicked', { isAbsoluteTime: absTime });
    } else {
      copyStringToClipboard(
        url !== undefined
          ? `${window.location.protocol}//${window.location.host}${config.appSubUrl}${url}`
          : global.location.href
      );
      reportInteraction('grafana_explore_copy_link_clicked', { isAbsoluteTime: absTime });
    }
  };

  const menuOptions: ShortLinkGroupData[] = [
    {
      key: 'normal',
      label: t('explore.toolbar.copy-links-normal-category', 'Normal URL links'),
      items: [
        {
          key: 'copy-shortened-link',
          icon: 'link',
          label: t('explore.toolbar.copy-shortened-link', 'Copy shortened URL'),
          getUrl: () => undefined,
          shorten: true,
          absTime: false,
        },
        {
          key: 'copy-link',
          icon: 'link',
          label: t('explore.toolbar.copy-link', 'Copy URL'),
          getUrl: () => undefined,
          shorten: false,
          absTime: false,
        },
      ],
    },
    {
      key: 'timesync',
      label: t('explore.toolbar.copy-links-absolute-category', 'Time-sync URL links (share with time range intact)'),
      items: [
        {
          key: 'copy-short-link-abs-time',
          icon: 'clock-nine',
          label: t('explore.toolbar.copy-shortened-link-abs-time', 'Copy absolute shortened URL'),
          shorten: true,
          getUrl: () => {
            return constructAbsoluteUrl(panes);
          },
          absTime: true,
        },
        {
          key: 'copy-link-abs-time',
          icon: 'clock-nine',
          label: t('explore.toolbar.copy-link-abs-time', 'Copy absolute URL'),
          shorten: false,
          getUrl: () => {
            return constructAbsoluteUrl(panes);
          },
          absTime: true,
        },
      ],
    },
  ];

  const MenuActions = (
    <Menu>
      {menuOptions.map((groupOption) => {
        return (
          <MenuGroup key={groupOption.key} label={groupOption.label}>
            {groupOption.items.map((option) => {
              return (
                <Menu.Item
                  key={option.key}
                  label={option.label}
                  icon={option.icon}
                  onClick={() => {
                    const url = option.getUrl();
                    onCopyLink(option.shorten, option.absTime, url);
                    setLastSelected(option);
                  }}
                />
              );
            })}
          </MenuGroup>
        );
      })}
    </Menu>
  );

  // we need the Toolbar button click to be an action separate from opening/closing the menu
  return (
    <ButtonGroup>
      <Button
        tooltip={lastSelected.label}
        icon={lastSelected.icon}
        size="sm"
        variant="secondary"
        onClick={() => {
          const url = lastSelected.getUrl();
          onCopyLink(lastSelected.shorten, lastSelected.absTime, url);
        }}
        aria-label={t('explore.toolbar.copy-shortened-link', 'Copy shortened URL')}
      >
        <Trans i18nKey="explore.toolbar.copy-shortened-link-label">Share</Trans>
      </Button>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
        <Button
          variant={'secondary'}
          size="sm"
          icon={isOpen ? 'angle-up' : 'angle-down'}
          aria-label={t('explore.toolbar.copy-shortened-link-menu', 'Open copy link options')}
        />
      </Dropdown>
    </ButtonGroup>
  );
}
