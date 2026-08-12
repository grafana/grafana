import { t } from '@grafana/i18n';
import { Badge, Stack, TagList, Text } from '@grafana/ui';

interface Props {
  title?: string;
  tags?: string[];
  timeFrom: string;
  timeTo: string;
}

// The notebook document header: a "Published Notebook" badge, the title, and a meta line with
// the time range and tags. Presentational only, so it stays out of the layout manager and can
// be tested on its own.
export function NotebookDocumentHeader({ title, tags, timeFrom, timeTo }: Props) {
  return (
    <Stack direction="column" gap={1} alignItems="flex-start">
      <Badge text={t('dashboard.notebook-layout.pill', 'Published Notebook')} color="blue" icon="book" />
      {title ? (
        <Text element="h1" variant="h1">
          {title}
        </Text>
      ) : null}
      <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
        <Text variant="bodySmall" color="secondary">
          {t('dashboard.notebook-layout.time', 'Time')}: {timeFrom} → {timeTo}
        </Text>
        {tags && tags.length > 0 ? <TagList tags={tags} /> : null}
      </Stack>
    </Stack>
  );
}
