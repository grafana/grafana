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
   * Not wired up yet. Edit mode owns cell insertion, so until it passes a handler the menu is inert
   * by construction rather than by a scattering of empty click handlers.
   */
  onAdd?: (type: NotebookBlockType, index: number) => void;
}

/**
 * The block-type menu, shared by every add-block affordance. One definition, because the block types and
 * their icons are the notebook's vocabulary rather than a property of which control you clicked — two
 * copies would let the dividers' menu and the end-of-document prompt's menu drift apart, and only one of
 * them would be the one under test.
 */
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
        // childItems is what renders the chevron and floats the submenu; a non-empty list is required
        // for either. Placeholder until edit mode can offer real visualizations to pick from.
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
