import { css, cx } from '@emotion/css';
import { useId } from 'react';

import { dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Card, TagList, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import { type NotebookRow } from '../list/useNotebooksList';

const RADIO_GROUP_NAME = 'notebook-picker';

interface Props {
  notebook: NotebookRow;
  isSelected: boolean;
  onSelect: (uid: string) => void;
}

export function NotebookPickerCard({ notebook, isSelected, onSelect }: Props) {
  const styles = useStyles2(getStyles);
  const updatedId = useId();
  const authorId = useId();

  return (
    // A native radio per card rather than Card's `onClick` button, so the list is a single tab stop
    // the browser walks with the arrow keys. Card's own `isSelected` radio can't: each gets a unique
    // `name`, so they never group. Without `onClick` Card draws no hover or focus, hence drawing them here.
    <Card noMargin className={cx(styles.card, isSelected && styles.selected)}>
      <input
        type="radio"
        name={RADIO_GROUP_NAME}
        className={styles.input}
        checked={isSelected}
        onChange={() => onSelect(notebook.uid)}
        aria-label={notebook.title}
        // Card.Meta takes no id of its own, hence pointing at each entry.
        aria-describedby={`${updatedId} ${authorId}`}
      />
      <Card.Heading>{notebook.title}</Card.Heading>
      {/* Dots rather than the default vertical bar, per the design. */}
      <Card.Meta separator="·">
        {[
          <span key="updated" id={updatedId}>
            {t('notebooks.add-panel.card-updated', 'Updated {{when}}', {
              when: dateTimeFormatTimeAgo(notebook.updated),
            })}
          </span>,
          <span key="author" id={authorId}>
            {t('notebooks.add-panel.card-author', 'By {{author}}', {
              author: notebook.authorName,
              interpolation: { escapeValue: false },
            })}
          </span>,
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
  // Covers the card, so a click anywhere on it selects.
  input: css({
    position: 'absolute',
    inset: 0,
    opacity: 0,
    cursor: 'pointer',
  }),
  // What CardContainer draws for a clickable card.
  card: css({
    '&:hover': {
      background: theme.colors.emphasize(theme.components.card.background, 0.03),
    },
    '&:has(:focus-visible)': getFocusStyles(theme),
  }),
  // TagList right-aligns by default, and this row spans the card, so the tags would otherwise sit
  // at the far edge instead of under the meta line they belong to.
  tagList: css({ justifyContent: 'flex-start' }),
  // What CardContainer draws for `isSelected`, so the picker still looks like every selectable card.
  selected: css({
    outline: `solid 1px ${theme.colors.accent.border}`,
  }),
});
