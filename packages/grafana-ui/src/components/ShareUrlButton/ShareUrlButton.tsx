import { css } from '@emotion/css';
import { useRef, useState } from 'react';

import { GrafanaTheme2, rangeUtil, toUtc } from '@grafana/data';

import { copyText } from '../../../src/utils/clipboard';
import { useStyles2 } from '../../themes';
import { Button, ButtonGroup, ButtonProps } from '../Button';
import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { Dropdown } from '../Dropdown/Dropdown';
import { Menu } from '../Menu/Menu';
import { MenuItemElement } from '../Menu/MenuItem';

export interface Props extends ButtonProps {
  /** */
  collapsed?: boolean;
}

export function ShareUrlButton({ collapsed }: Props) {
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
      <Menu.Group label="Time-sync URL links (share with time range intact)">
        <Menu.Item
          key="copy-url"
          label="Copy URL with absolute time range"
          icon="clock-nine"
          onClick={() => copyText(absoluteTimeRangeURL(), absoluteUrlRef)}
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
        tooltip={'Copy URL with absolute time range'}
        getText={() => absoluteTimeRangeURL()}
      >
        <span className={collapsed ? styles.collapsed : styles.shareText}>Share</span>
      </ClipboardButton>
      <Dropdown overlay={menu} placement="bottom-start" onVisibleChange={() => setIsOpen(!isOpen)}>
        <Button variant="secondary" size="md" icon={isOpen ? 'angle-down' : 'angle-up'} />
      </Dropdown>
    </ButtonGroup>
  );
};

function absoluteTimeRangeURL(url?: string) {
  const MINUTE_IN_MILLISECONDS = 60 * 1000;
  const queryParams = new URLSearchParams(url ? new URL(url).search : window.location.search);
  const href = url ? new URL(url).href : window.location.href;

  const from = queryParams.get('from');
  const to = queryParams.get('to');

  if (!from || !to) {
    // If no time range is found in the URL, we default to the last 30 minutes
    queryParams.set('to', toUtc(Date.now()).valueOf().toString());
    queryParams.set(
      'from',
      toUtc(Date.now() - (30 * MINUTE_IN_MILLISECONDS))
        .valueOf()
        .toString()
    );

    return `${href.split('?')?.[0] ?? href}?${queryParams.toString()}`;
  }

  if (rangeUtil.isRelativeTime(to) || rangeUtil.isRelativeTime(from)) {
    const range = rangeUtil.convertRawToRange({ from, to });

    queryParams.set('from', toUtc(range.from).valueOf().toString());
    queryParams.set('to', toUtc(range.to).valueOf().toString());

    return `${href.split('?')?.[0] ?? href}?${queryParams.toString()}`;
  }

  return href;
}


const getStyles = (theme: GrafanaTheme2) => ({
  copy: css({
    marginLeft: 'auto',
    marginRight: '0',
    padding: '0 8px',
    'svg': css({
      marginRight: '0',
    }),
  }),
  collapsed: css({
    marginLeft: '8px',
    display: 'none',
  }),
  shareText: css({
    marginLeft: '8px',
    '@media screen and (max-width: 1040px)': {
      display: 'none', /*Won't be displayed on screens below or equal to 1040px width*/
    },
  }),
});
