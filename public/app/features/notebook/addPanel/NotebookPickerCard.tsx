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
    // Without Card's `isSelected`: it renders an inert radio that stayed focusable however it was
    // hidden, giving every card a second, invisible tab stop. Card hangs the selected outline on the
    // same prop, hence drawing it here.
    <Card
      noMargin
      className={isSelected ? styles.selected : undefined}
      onClick={() => onSelect(notebook.uid)}
      aria-current={isSelected ? true : undefined}
    >
      {/* In the button's own name: aria-current on the wrapper is not announced when the button
          inside it takes focus, and Card.Heading passes nothing else through. */}
      <Card.Heading
        aria-label={
          isSelected
            ? t('notebooks.add-panel.card-selected', '{{title}} (selected)', { title: notebook.title })
            : undefined
        }
      >
        {notebook.title}
      </Card.Heading>
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
  // What CardContainer draws for `isSelected`, so the picker still looks like every selectable card.
  selected: css({
    outline: `solid 1px ${theme.colors.accent.border}`,
  }),
});
