import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';

interface Props {
  onDuplicate: () => void;
  onDelete: () => void;
}

/** Shared block actions, opened by clicking the same gutter handle used for dragging. */
export function NotebookCellActions({ onDuplicate, onDelete }: Props) {
  return (
    <Menu>
      <Menu.Item icon="copy" label={t('notebook.cell.duplicate', 'Duplicate block')} onClick={onDuplicate} />
      <Menu.Item icon="trash-alt" label={t('notebook.cell.delete', 'Delete block')} onClick={onDelete} />
    </Menu>
  );
}
