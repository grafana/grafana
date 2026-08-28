import { type GrafanaTheme2, type TimeRange, type TimeZone } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Stack, TagList, Text, useStyles2, type WeekStart } from '@grafana/ui';

import { getNeutralTagListStyle } from '../../tagColors';

import { NotebookTagPicker } from './NotebookTagPicker';
import { NotebookTimeRangePicker } from './NotebookTimeRangePicker';

const TAGS_INPUT_ID = 'notebook-tags';
const TIME_LABEL_ID = 'notebook-time-label';

interface Props {
  title?: string;
  tags?: string[];
  timeRange: TimeRange;
  timeZone: TimeZone;
  weekStart?: WeekStart;
  hideTimeControls?: boolean;
  isEditing?: boolean;
  onTagsChange?: (tags: string[]) => void;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  onTimeZoneChange: (timeZone: TimeZone) => void;
}

// The notebook document header: a "Published Notebook" badge, the title, and the document's metadata
// as labelled rows. Presentational only, so it stays out of the layout manager and can be tested on
// its own — editing arrives as a callback rather than by reaching for the scene.
export function NotebookDocumentHeader({
  title,
  tags,
  timeRange,
  timeZone,
  weekStart,
  hideTimeControls,
  isEditing,
  onTagsChange,
  onTimeRangeChange,
  onTimeZoneChange,
}: Props) {
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

      {!hideTimeControls && (
        // Grouped and labelled by the row's own label: the picker is a button, so htmlFor would
        // associate with nothing and its only name would be the range it is currently showing.
        <MetaRow label={t('dashboard.notebook-layout.time', 'Time')} labelId={TIME_LABEL_ID}>
          <div role="group" aria-labelledby={TIME_LABEL_ID}>
            <NotebookTimeRangePicker
              value={timeRange}
              timeZone={timeZone}
              weekStart={weekStart}
              onChange={onTimeRangeChange}
              onChangeTimeZone={onTimeZoneChange}
            />
          </div>
        </MetaRow>
      )}

      {showTags ? (
        // Full width so the picker can take the rest of the line: the outer Stack aligns to
        // flex-start, which would otherwise shrink this row to its content.
        <MetaRow label={tagsLabel} htmlFor={canEditTags ? TAGS_INPUT_ID : undefined} fillWidth={canEditTags}>
          {canEditTags && onTagsChange ? (
            // Its chips are neutral without being asked, ValuePill using the same two tokens the
            // read-mode override in tagColors.ts applies.
            <NotebookTagPicker id={TAGS_INPUT_ID} tags={tags} onChange={onTagsChange} />
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
  labelId,
  fillWidth,
  children,
}: {
  label: string;
  /** Set when the row owns a form control, so the visible label is really its label. */
  htmlFor?: string;
  /** Set when the row's control can only be named by reference, rather than by wrapping it. */
  labelId?: string;
  fillWidth?: boolean;
  children: React.ReactNode;
}) {
  // A native label rather than grafana-ui's Label, so the two rows stay typographically identical
  // while the one with a control still associates properly.
  const Wrapper = htmlFor ? 'label' : 'span';

  return (
    <Stack direction="row" gap={2} alignItems="center" width={fillWidth ? '100%' : undefined}>
      <Wrapper htmlFor={htmlFor} id={labelId}>
        {/* `body` is the theme's 14px step; `bodySmall` would be 12. */}
        <Text variant="body" color="secondary">
          {label}
        </Text>
      </Wrapper>
      {children}
    </Stack>
  );
}
