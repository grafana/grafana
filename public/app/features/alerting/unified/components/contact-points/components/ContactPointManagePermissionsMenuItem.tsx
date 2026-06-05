import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';

export interface ContactPointManagePermissionsMenuItemProps {
  onOpen: () => void;
}

export function ContactPointManagePermissionsMenuItem({ onOpen }: ContactPointManagePermissionsMenuItemProps) {
  return (
    <Menu.Item
      icon="unlock"
      label={t('alerting.contact-point-header.label-manage-permissions', 'Manage permissions')}
      onClick={onOpen}
    />
  );
}
