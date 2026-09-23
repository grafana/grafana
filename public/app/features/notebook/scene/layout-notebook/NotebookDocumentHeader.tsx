import { t } from '@grafana/i18n';
import { Stack, TagList, Text } from '@grafana/ui';

import { NotebookTagsField } from '../../NotebookTagsField';

import { NotebookTitleEditor } from './NotebookTitleEditor';

const TAGS_INPUT_ID = 'notebook-tags';

interface Props {
  title?: string;
  tags?: string[];
  timeFrom: string;
  timeTo: string;
  isEditing?: boolean;
  onTagsChange?: (tags: string[]) => void;
  onTitleChange?: (title: string) => void;
}

// The notebook document header: the title and the document's metadata as labelled rows.
// Presentational only, so it stays out of the layout manager and can be tested on its own — editing
// arrives as a callback rather than by reaching for the scene.
export function NotebookDocumentHeader({
  title,
  tags,
  timeFrom,
  timeTo,
  isEditing,
  onTagsChange,
  onTitleChange,
}: Props) {
  const canEditTags = Boolean(isEditing && onTagsChange);
  const canEditTitle = Boolean(isEditing && onTitleChange);
  // While reading, an untagged notebook shows no Tags row at all; while editing it always shows one,
  // because that row is the only way to add the first tag.
  const showTags = canEditTags || Boolean(tags?.length);
  const tagsLabel = t('dashboard.notebook-layout.tags', 'Tags');

  return (
    <Stack direction="column" gap={1} alignItems="flex-start">
      {canEditTitle && onTitleChange ? (
        <NotebookTitleEditor title={title ?? ''} onChange={onTitleChange} />
      ) : title ? (
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
        <MetaRow label={tagsLabel} htmlFor={canEditTags ? TAGS_INPUT_ID : undefined}>
          {canEditTags && onTagsChange ? (
            <NotebookTagsField
              inputId={TAGS_INPUT_ID}
              value={tags ?? []}
              onChange={onTagsChange}
              allowCustomValue
              placeholder={t('dashboard.notebook-layout.tags-placeholder', 'Add a tag')}
            />
          ) : (
            <TagList tags={tags ?? []} />
          )}
        </MetaRow>
      ) : null}
    </Stack>
  );
}

/**
 * One line of document metadata: a dimmed label, then its value.
 *
 * "Time" and "Tags" are near enough the same width that they line up without a fixed label column, so
 * this stays plain layout components rather than a grid.
 */
function MetaRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  /** Set when the row owns a form control, so the visible label is really its label. */
  htmlFor?: string;
  children: React.ReactNode;
}) {
  // A native label rather than grafana-ui's Label, so the two rows stay typographically identical
  // while the one with a control still associates properly.
  const Wrapper = htmlFor ? 'label' : 'span';

  return (
    <Stack direction="row" gap={2} alignItems="center">
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
