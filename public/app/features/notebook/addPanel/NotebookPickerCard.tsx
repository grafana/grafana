import { css } from '@emotion/css';

import { dateTimeFormatTimeAgo } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Card, TagList, useStyles2 } from '@grafana/ui';

import { type NotebookRow } from '../list/useNotebooksList';

interface Props {
  notebook: NotebookRow;
  isSelected: boolean;
  onSelect: (uid: string) => void;
}

export function NotebookPickerCard({ notebook, isSelected, onSelect }: Props) {
  const styles = useStyles2(getStyles);

  return (
    // isSelected renders Card's own radio affordance, labelled by the heading — the supported way to
    // make a list of cards a single-choice picker.
    <Card noMargin className={styles.card} isSelected={isSelected} onClick={() => onSelect(notebook.uid)}>
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

const getStyles = () => ({
  card: css({
    // The card's own selected styling already shows which notebook is chosen, so the radio it
    // renders alongside the title is redundant to look at. Hidden the same way as the global
    // .sr-only rule rather than with `display: none`, so it stays in the accessibility tree and a
    // screen reader still hears a single-choice list.
    'input[type="radio"]': {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: 0,
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      border: 0,
    },
  }),
});

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
