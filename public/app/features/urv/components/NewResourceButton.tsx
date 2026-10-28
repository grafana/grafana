import { t } from '@grafana/i18n';
import { Button, Dropdown, Menu } from '@grafana/ui';

import { creatableKinds } from '../kinds';

interface Props {
  /** New things go in the folder being browsed, where the create page supports it. */
  folderUID?: string;
  onNewFolder: () => void;
}

export function NewResourceButton({ folderUID, onNewFolder }: Props) {
  const menu = (
    <Menu>
      {creatableKinds().map(({ groupResource, info }) => (
        <Menu.Item key={groupResource} label={info.label()} icon={info.icon} url={info.createUrl?.(folderUID)} />
      ))}
      <Menu.Divider />
      <Menu.Item label={t('urv.new.folder', 'Folder')} icon="folder-plus" onClick={onNewFolder} />
      <Menu.Item label={t('urv.new.import', 'Import dashboard')} icon="import" url="/dashboard/import" />
    </Menu>
  );

  return (
    <Dropdown overlay={menu} placement="bottom-end">
      <Button icon="plus">{t('urv.new.button', 'New')}</Button>
    </Dropdown>
  );
}
