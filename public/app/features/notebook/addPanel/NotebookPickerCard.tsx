import { dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Card, TagList } from '@grafana/ui';

import { type NotebookRow } from '../list/useNotebooksList';

interface Props {
  notebook: NotebookRow;
  isSelected: boolean;
  onSelect: (uid: string) => void;
}

export function NotebookPickerCard({ notebook, isSelected, onSelect }: Props) {
  return (
    // isSelected renders Card's own radio affordance, labelled by the heading — the supported way to
    // make a list of cards a single-choice picker.
    <Card noMargin isSelected={isSelected} onClick={() => onSelect(notebook.uid)}>
      <Card.Heading>{notebook.title}</Card.Heading>
      <Card.Meta>
        {[
          t('notebooks.add-panel.card-updated', 'Updated {{when}}', { when: dateTimeFormatTimeAgo(notebook.updated) }),
          blockLabel(notebook.blockCount),
          t('notebooks.add-panel.card-author', 'By {{author}}', { author: notebook.authorName }),
        ]}
      </Card.Meta>
      {notebook.tags.length > 0 && (
        <Card.Tags>
          <TagList tags={notebook.tags} />
        </Card.Tags>
      )}
    </Card>
  );
}

function blockLabel(count: number): string {
  if (count === 0) {
    return t('notebooks.add-panel.card-empty', 'empty');
  }

  return t('notebooks.add-panel.card-blocks', '', {
    count,
    defaultValue_one: '{{count}} block',
    defaultValue_other: '{{count}} blocks',
  });
}
