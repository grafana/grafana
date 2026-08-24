import { css, cx } from '@emotion/css';

import { dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Card, TagList, useStyles2 } from '@grafana/ui';

import { type NotebookRow } from '../list/useNotebooksList';
import { getNeutralTagListStyle } from '../tagColors';

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
      {/* Dots rather than the default vertical bar, per the design. */}
      <Card.Meta separator="·">
        {[
          t('notebooks.add-panel.card-updated', 'Updated {{when}}', { when: dateTimeFormatTimeAgo(notebook.updated) }),
          t('notebooks.add-panel.card-author', 'By {{author}}', { author: notebook.authorName }),
        ]}
      </Card.Meta>
      {/* The Description slot rather than Card.Tags: Tags is a right-hand column of the card's grid,
          beside the meta line, and the design puts the tags on their own line under it. Description is
          the row below Meta, so this needs no reaching into the card's own layout. */}
      {notebook.tags.length > 0 && (
        <Card.Description>
          {/* TagList right-aligns by default, and here it spans the width of the card. */}
          <TagList tags={notebook.tags} className={styles.tagList} />
        </Card.Description>
      )}
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The same neutral grey the list table and the document header use, rather than TagList's own
  // per-tag colours: a tag is context here, not something to pick out of the card.
  tagList: cx(getNeutralTagListStyle(theme), css({ justifyContent: 'flex-start' })),
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
