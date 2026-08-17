import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Stack, TagList, TagsInput, Text, useStyles2 } from '@grafana/ui';

import { getNeutralTagListStyle } from '../../tagColors';

const TAGS_INPUT_ID = 'notebook-tags';

interface Props {
  title?: string;
  tags?: string[];
  timeFrom: string;
  timeTo: string;
  isEditing?: boolean;
  onTagsChange?: (tags: string[]) => void;
}

// The notebook document header: a "Published Notebook" badge, the title, and the document's metadata
// as labelled rows. Presentational only, so it stays out of the layout manager and can be tested on
// its own — editing arrives as a callback rather than by reaching for the scene.
export function NotebookDocumentHeader({ title, tags, timeFrom, timeTo, isEditing, onTagsChange }: Props) {
  const styles = useStyles2(getStyles);
  const canEditTags = Boolean(isEditing && onTagsChange);
  // While reading, an untagged notebook shows no Tags row at all; while editing it always shows one,
  // because that row is the only way to add the first tag.
  const showTags = canEditTags || Boolean(tags?.length);
  const tagsLabel = t('dashboard.notebook-layout.tags', 'Tags');

  return (
    <Stack direction="column" gap={1} alignItems="flex-start">
      <Badge text={t('dashboard.notebook-layout.pill', 'Published Notebook')} color="blue" icon="book" />
      {title ? (
        <Text element="h1" variant="h1">
          {title}
        </Text>
      ) : null}

      <MetaRow label={t('dashboard.notebook-layout.time', 'Time')}>
        <Text variant="bodySmall">
          {timeFrom} → {timeTo}
        </Text>
      </MetaRow>

      {showTags ? (
        // Full width so the picker can take the rest of the line: the outer Stack aligns to
        // flex-start, which would otherwise shrink this row to its content.
        <MetaRow label={tagsLabel} htmlFor={canEditTags ? TAGS_INPUT_ID : undefined} fillWidth={canEditTags}>
          {canEditTags && onTagsChange ? (
            <TagsInput
              id={TAGS_INPUT_ID}
              tags={tags ?? []}
              // Neutral rather than a colour per name, matching the read-mode tags and the list page.
              // A first-class prop here, unlike TagList, which needs the override in tagColors.ts.
              autoColors={false}
              placeholder={t('dashboard.notebook-layout.tags-placeholder', 'Add a tag')}
              onChange={(next) => onTagsChange(normalizeTags(next))}
            />
          ) : (
            <TagList tags={tags ?? []} className={styles.neutralTags} />
          )}
        </MetaRow>
      ) : null}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  neutralTags: getNeutralTagListStyle(theme),
});

/**
 * One line of document metadata: a dimmed label, then its value.
 *
 * "Time" and "Tags" are near enough the same width that they line up without a fixed label column, so
 * this stays plain layout components rather than a grid.
 */
function MetaRow({
  label,
  htmlFor,
  fillWidth,
  children,
}: {
  label: string;
  /** Set when the row owns a form control, so the visible label is really its label. */
  htmlFor?: string;
  fillWidth?: boolean;
  children: React.ReactNode;
}) {
  // A native label rather than grafana-ui's Label, so the two rows stay typographically identical
  // while the one with a control still associates properly.
  const Wrapper = htmlFor ? 'label' : 'span';

  return (
    <Stack direction="row" gap={2} alignItems="center" width={fillWidth ? '100%' : undefined}>
      <Wrapper htmlFor={htmlFor}>
        {/* `body` is the theme's 14px step; `bodySmall` would be 12. */}
        <Text variant="body" color="secondary">
          {label}
        </Text>
      </Wrapper>
      {children}
    </Stack>
  );
}

/**
 * A custom value arrives as the raw string the user typed, so `latency ` would otherwise become a tag
 * that renders identically to `latency` but is not equal to it.
 *
 * Case is deliberately left alone. Lowercasing would also rewrite tags picked *from the dropdown* — a
 * notebook tagged `Production` would silently become `production` the moment anything else was
 * changed — and tags are case-sensitive everywhere else in Grafana.
 */
function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}
