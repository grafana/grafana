import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';

/** The block types the add-block menu offers. Insertion itself belongs to edit mode. */
export type NotebookBlockType = 'heading' | 'paragraph' | 'code' | 'visualization';

interface Props {
  /**
   * What a pick means is the caller's business, not this menu's — inserting a new block at a position
   * (NotebookAddBlockDivider) and converting the cell that's already showing this menu in place
   * (NotebookCellRenderer's trailing-slot markdown cell) both just need "which type did they pick".
   * Optional so the menu stays renderable on its own: without a handler it's inert by construction
   * rather than by a scattering of empty click handlers. Not every type is buildable yet — the caller
   * decides which picks it acts on.
   */
  onPick?: (type: NotebookBlockType) => void;
}

export function NotebookBlockTypeMenu({ onPick }: Props) {
  return (
    <Menu>
      <Menu.Item
        icon="text-fields"
        label={t('notebook.add-block.heading', 'Heading')}
        onClick={() => onPick?.('heading')}
      />
      <Menu.Item
        icon="align-left"
        label={t('notebook.add-block.paragraph', 'Paragraph')}
        onClick={() => onPick?.('paragraph')}
      />
      <Menu.Item icon="brackets-curly" label={t('notebook.add-block.code', 'Code')} onClick={() => onPick?.('code')} />
      <Menu.Item
        icon="graph-bar"
        label={t('notebook.add-block.visualization', 'Visualization')}
        onClick={() => onPick?.('visualization')}
      />
    </Menu>
  );
}
