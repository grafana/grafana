import { css } from '@emotion/css';
import { useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';

import { copyText } from '../../utils/clipboard';
import { absoluteTimeRangeURL } from '../../utils/time';
import { useStyles2 } from '../../themes';
import { t, Trans } from '../../utils/i18n';
import { Button, ButtonGroup, ButtonProps } from '../Button';
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

export function ShareTimeRangeButton({ collapsed, url, fromParam, toParam }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const styles = useStyles2(getStyles);

  const relativeUrlRef = useRef<MenuItemElement>(null);
  const absoluteUrlRef = useRef<MenuItemElement>(null);

  const clickHandler = (text: string, ref: React.RefObject<MenuItemElement>) => {
    copyText(text, ref);
    getAppEvents().publish({
      type: AppEvents.alertSuccess.name,
      payload: t('grafana-ui.toolbar.copy-link-success', 'URL copied to clipboard'),
    });
    setIsOpen(false);
  };

  const menu = (
    <Menu>
      <Menu.Item
        key="copy-url-relative"
        label={t('grafana-ui.toolbar.copy-link', 'Copy URL')}
        icon="link"
        onClick={() => clickHandler(url ?? window.location.href, relativeUrlRef)}
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
    <Dropdown overlay={menu} placement="bottom-start" onVisibleChange={() => setIsOpen(!isOpen)}>
      <ButtonGroup>
        <Button
          className={styles.copy}
          variant="secondary"
          size="md"
          icon="share-alt"
          tooltip={t('grafana-ui.toolbar.copy-link-abs-time', 'Copy absolute URL')}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={collapsed ? styles.collapsed : styles.shareText}>
            <Trans i18nKey="grafana-ui.toolbar.copy-shortened-link-label">Share</Trans>
          </span>
        </Button>
        <Button variant="secondary" size="md" icon={isOpen ? 'angle-up' : 'angle-down'} />
      </ButtonGroup>
    </Dropdown>
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
