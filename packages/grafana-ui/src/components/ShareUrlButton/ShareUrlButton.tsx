import { css } from '@emotion/css';
import { useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { copyText } from '../../../src/utils/clipboard';
import { absoluteTimeRangeURL } from '../../../src/utils/time';
import { useStyles2 } from '../../themes';
import { t, Trans } from '../../utils/i18n';
import { Button, ButtonGroup, ButtonProps } from '../Button';
import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { Dropdown } from '../Dropdown/Dropdown';
import { Menu } from '../Menu/Menu';
import { MenuItemElement } from '../Menu/MenuItem';

export interface Props extends ButtonProps {
  /**
   * Whether to collapse the button text
   */
  collapsed?: boolean;

  /**
   * The URL to share
   */
  url?: string;

  /**
   * The from parameter to use in the URL
   *
   * @default 'from'
   */
  fromParam?: string;

  /**
   * The to parameter to use in the URL
   *
   * @default 'to'
   */
  toParam?: string;
}

export function ShareUrlButton({ collapsed, url, fromParam, toParam }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles2(getStyles);

  const relativeUrlRef = useRef<null | MenuItemElement>(null);
  const absoluteUrlRef = useRef<null | MenuItemElement>(null);

  const menu = (
    <Menu>
      <Menu.Group label="Normal URL links">
        <Menu.Item
          key="copy-url-relative"
          label="Copy URL"
          icon="link"
          onClick={() => copyText(window.location.href, relativeUrlRef)}
          ref={relativeUrlRef}
        />
      </Menu.Group>
      <Menu.Group label={t('explore.toolbar.copy-links-absolute-category', 'Time-sync URL links (share with time range intact)')}>
        <Menu.Item
          key="copy-url"
          label={t('explore.toolbar.copy-link-abs-time', 'Copy absolute URL')}
          icon="clock-nine"
          onClick={() => copyText(absoluteTimeRangeURL({ url, fromParam, toParam }), absoluteUrlRef)}
          ref={absoluteUrlRef}
        />
      </Menu.Group>
    </Menu>
  );

  return (
    <ButtonGroup>
      <ClipboardButton
        className={styles.copy}
        variant="secondary"
        size="md"
        icon="share-alt"
        tooltip={t('explore.toolbar.copy-link-abs-time', 'Copy absolute URL')}
        getText={() => absoluteTimeRangeURL()}
      >
        <span className={collapsed ? styles.collapsed : styles.shareText}>
          <Trans i18nKey="explore.toolbar.copy-shortened-link-label">Share</Trans>
        </span>
      </ClipboardButton>
      <Dropdown overlay={menu} placement="bottom-start" onVisibleChange={() => setIsOpen(!isOpen)}>
        <Button variant="secondary" size="md" icon={isOpen ? 'angle-down' : 'angle-up'} />
      </Dropdown>
    </ButtonGroup>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  copy: css({
    marginLeft: 'auto',
    marginRight: '0',
    padding: '0 8px',
    svg: css({
      marginRight: '0',
    }),
  }),
  collapsed: css({
    marginLeft: '8px',
    display: 'none',
  }),
  shareText: css({
    marginLeft: '8px',
    '@media screen and (max-width: 1040px)': css({
      display: 'none', // won't be displayed on screens below or equal to 1040px width
    }),
  }),
});
