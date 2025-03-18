import { css } from '@emotion/css';
import { useRef, useState } from 'react';

import { GrafanaTheme2, rangeUtil, toUtc } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { copyText } from '../../utils/clipboard';
import { t, Trans } from '../../utils/i18n';
import { absoluteTimeRangeURL } from '../../utils/time';
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

export function ShareTimeRangeButton({ collapsed, url: urlProp, fromParam, toParam }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles2(getStyles);
  const url = urlProp ?? window.location.href;

  const relativeUrlRef = useRef<MenuItemElement>(null);
  const absoluteUrlRef = useRef<MenuItemElement>(null);

  const clickHandler = (text: string, ref: React.RefObject<MenuItemElement>) => {
    copyText(text, ref);
    setIsOpen(false);
  };

  console.log('url', url);
  console.log('absoluteTimeRangeURL', absoluteTimeRangeURL);
  console.log('rangeUtil', rangeUtil.convertRawToRange);
  console.log('toUTC', toUtc);

  const menu = (
    <Menu>
      <Menu.Item
        key="copy-url-relative"
        label={t('grafana-ui.toolbar.copy-link', 'Copy URL')}
        icon="link"
        onClick={() => clickHandler(url, relativeUrlRef)}
        ref={relativeUrlRef}
      />
      <Menu.Item
        key="copy-url"
        label={t('grafana-ui.toolbar.copy-link-abs-time', 'Copy absolute URL')}
        icon="clock-nine"
        onClick={() => clickHandler(absoluteTimeRangeURL({ url, fromParam, toParam }), absoluteUrlRef)}
        ref={absoluteUrlRef}
      />
    </Menu>
  );

  return (
    <ButtonGroup>
      <ClipboardButton
        className={styles.copy}
        variant="secondary"
        size="md"
        icon="share-alt"
        tooltip={t('grafana-ui.toolbar.copy-link-abs-time', 'Copy absolute URL')}
        getText={() => absoluteTimeRangeURL({ url, fromParam, toParam })}
      >
        <span className={collapsed ? styles.collapsed : styles.shareText}>
          <Trans i18nKey="grafana-ui.toolbar.copy-shortened-link-label">Share</Trans>
        </span>
      </ClipboardButton>
      <Dropdown overlay={menu} placement="bottom-start" onVisibleChange={() => setIsOpen(!isOpen)}>

        <Button variant="secondary" size="md" icon={isOpen ? 'angle-up' : 'angle-down'} />
      </Dropdown>

    </ButtonGroup>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  copy: css({
    marginRight: `${theme.spacing(0)}`,
    padding: `${theme.spacing(0, 1)}`,
    svg: css({
      marginRight: `${theme.spacing(0)}`,
    }),
  }),
  collapsed: css({
    marginLeft: `${theme.spacing(1)}`,
    display: 'none',
  }),
  shareText: css({
    marginLeft: `${theme.spacing(1)}`,
  }),
});
