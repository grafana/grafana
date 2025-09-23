import { Dropdown, Button, IconButton, Menu, Stack, Icon } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface EditPaneHeaderProps {
  title: string;
  onDelete?: () => void;
  onCopy?: () => void;
  onDuplicate?: () => void;
}

export const EditPaneHeader = ({ title, onDelete, onCopy, onDuplicate }: EditPaneHeaderProps) => {
  const addCopyOrDuplicate = onCopy || onDuplicate;
  return (
    <Stack justifyContent="space-between" alignItems="center" width="100%">
      <span>{title}</span>
      <Stack alignItems="center">
        {addCopyOrDuplicate ? (
          <Dropdown overlay={<MenuItems onCopy={onCopy} onDuplicate={onDuplicate} />}>
            <Button
              tooltip={t('dashboard.layout.common.copy-or-duplicate', 'Copy or Duplicate')}
              tooltipPlacement="bottom"
              variant="secondary"
              fill="text"
              size="md"
            >
              <Icon name="copy" /> <Icon name="angle-down" />
            </Button>
          </Dropdown>
        ) : null}

        <IconButton
          size="md"
          variant="secondary"
          onClick={onDelete}
          name="trash-alt"
          tooltip={t('dashboard.layout.common.delete', 'Delete')}
        />
      </Stack>
    </Stack>
  );
};

type MenuItemsProps = {
  onCopy?: () => void;
  onDuplicate?: () => void;
};

const MenuItems = ({ onCopy, onDuplicate }: MenuItemsProps) => {
  return (
    <Menu>
      {onCopy ? <Menu.Item label={t('dashboard.layout.common.copy', 'Copy')} onClick={onCopy} /> : null}
      {onDuplicate ? (
        <Menu.Item label={t('dashboard.layout.common.duplicate', 'Duplicate')} onClick={onDuplicate} />
      ) : null}
    </Menu>
  );
};
