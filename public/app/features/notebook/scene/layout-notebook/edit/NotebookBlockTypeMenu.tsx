import { t } from '@grafana/i18n';
import { Menu, type IconName } from '@grafana/ui';

/** The block types the add-block menu offers. Insertion itself belongs to edit mode. */
export type NotebookBlockType = 'heading' | 'paragraph' | 'code' | 'visualization';

export interface NotebookBlockTypeOption {
  type: NotebookBlockType;
  icon: IconName;
  label: string;
}

/** Shared by the dropdown menu below and the notebook's footer add-buttons, so the two can't drift apart. */
export function getNotebookBlockTypeOptions(): NotebookBlockTypeOption[] {
  return [
    { type: 'heading', icon: 'text-fields', label: t('notebook.add-block.heading', 'Heading') },
    { type: 'paragraph', icon: 'align-left', label: t('notebook.add-block.paragraph', 'Paragraph') },
    { type: 'code', icon: 'brackets-curly', label: t('notebook.add-block.code', 'Code') },
    { type: 'visualization', icon: 'graph-bar', label: t('notebook.add-block.visualization', 'Visualization') },
  ];
}

interface Props {
  onPick?: (type: NotebookBlockType) => void;
}

export function NotebookBlockTypeMenu({ onPick }: Props) {
  return (
    <Menu>
      {getNotebookBlockTypeOptions().map((option) => (
        <Menu.Item key={option.type} icon={option.icon} label={option.label} onClick={() => onPick?.(option.type)} />
      ))}
    </Menu>
  );
}
