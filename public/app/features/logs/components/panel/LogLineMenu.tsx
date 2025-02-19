import { Dropdown, IconButton, Menu } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { LogLineStyles } from './LogLine';
import { LogListModel } from './processing';

interface Props {
  log: LogListModel;
  styles: LogLineStyles;
}

export const LogLineMenu = ({ styles }: Props) => {
  const menu = (
    <Menu>
      <Menu.Item label={t('logs.log-line-menu.copy-log', 'Copy log line')} />
      <Menu.Item label={t('logs.log-line-menu.copy-link', 'Copy link to log line')} />
      <Menu.Divider />
      <Menu.Item label={t('logs.log-line-menu.show-context', 'Show context')} />
      <Menu.Item label={t('logs.log-line-menu.pin-to-outline', 'Pin to content outline')} />
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottom-start">
      <IconButton className={styles.menuIcon} name="ellipsis-v" aria-label="Log menu" />
    </Dropdown>
  );
};
