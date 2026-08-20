import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';

/** The block types the add-block menu offers. Insertion itself belongs to edit mode. */
export type NotebookBlockType = 'heading' | 'paragraph' | 'code' | 'visualization';

interface Props {
  /**
   * Where a pick would insert. A divider belongs to the cell above it, so the cell at position `i`
   * passes `i + 1`; the end-of-document prompt passes `cells.length`. The menu itself is indifferent —
   * it only carries the index back out.
   */
  index: number;
  /**
   * Optional so the menu stays renderable on its own: insertion belongs to the layout manager, and
   * without a handler the menu is inert by construction rather than by a scattering of empty click
   * handlers. Not every type is buildable yet — the manager decides which picks it acts on.
   */
  onAdd?: (type: NotebookBlockType, index: number) => void;
}

export function NotebookBlockTypeMenu({ index, onAdd }: Props) {
  return (
    <Menu>
      <Menu.Item
        icon="text-fields"
        label={t('notebook.add-block.heading', 'Heading')}
        onClick={() => onAdd?.('heading', index)}
      />
      <Menu.Item
        icon="align-left"
        label={t('notebook.add-block.paragraph', 'Paragraph')}
        onClick={() => onAdd?.('paragraph', index)}
      />
      <Menu.Item
        icon="brackets-curly"
        label={t('notebook.add-block.code', 'Code')}
        onClick={() => onAdd?.('code', index)}
      />
      <Menu.Item
        icon="graph-bar"
        label={t('notebook.add-block.visualization', 'Visualization')}
        childItems={[
          <Menu.Item
            key="placeholder"
            label={t('notebook.add-block.visualization-placeholder', 'Coming soon')}
            disabled
          />,
        ]}
        onClick={() => onAdd?.('visualization', index)}
      />
    </Menu>
  );
}
