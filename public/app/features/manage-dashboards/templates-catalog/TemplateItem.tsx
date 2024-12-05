import { css } from '@emotion/css';

import { GrafanaTheme2, locale } from '@grafana/data';
import { useStyles2, Box, Stack, Text } from '@grafana/ui';

import { Template, Link } from './types';

interface TemplateItemProps {
  dashboard: Template;
  compact?: boolean;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export function TemplateItem({ dashboard, compact = false, onClick }: TemplateItemProps) {
  const getThumbnailUrl = () => {
    const thumbnail = dashboard.screenshots?.[0]?.links.find((l: Link) => l.rel === 'image')?.href ?? '';
    return thumbnail ? `/api/gnet${thumbnail}` : '';
  };

  const styles = useStyles2(getStylesTemplateItem);
  const thumbnailUrl = getThumbnailUrl();
  const imgHeight = compact ? `100px` : '150px';
  const header = compact ? 'h5' : 'h4';
  const body = compact ? 'body' : 'bodySmall';

  return (
    <div className={styles.container} onClick={onClick}>
      <Box display="flex" direction="column" backgroundColor="secondary" paddingBottom={1} height="100%">
        <Box display="flex" height={imgHeight}>
          {thumbnailUrl ? (
            <img className={styles.img} src={getThumbnailUrl()} alt="Screenshot" />
          ) : (
            <Box
              backgroundColor="secondary"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flex="1"
              height={imgHeight}
            >
              No image
            </Box>
          )}
        </Box>
        <Box paddingY={1} paddingX={2}>
          <Stack direction="column">
            <Text variant={header}>{dashboard.name}</Text>
            <Text variant={body} color="secondary">
              {dashboard.description}
            </Text>
            <Text variant={body} color="secondary" weight="bold">
              {dashboard.datasource}
            </Text>
          </Stack>
        </Box>
        {!compact && (
          <Box
            display="flex"
            direction="row"
            paddingX={2}
            alignItems="center"
            justifyContent="space-between"
            minWidth="100%"
            paddingBottom={1}
          >
            <Stack direction="column" gap={0}>
              <Text variant="body">
                {dashboard.reviewsAvgRating} <Text color="warning">✮</Text>
              </Text>
              <Text variant="body" color="secondary">
                {locale(dashboard.reviewsCount, 0).text} Reviews
              </Text>
            </Stack>
            <Stack direction="column" gap={0}>
              <Text variant="body">{locale(dashboard.reviewsCount, 0).text}</Text>
              <Text variant="body" color="secondary">
                Downloads
              </Text>
            </Stack>
            <Stack direction="column" gap={0}>
              <Text variant="body">{dashboard.revision}</Text>
              <Text variant="body" color="secondary">
                Version
              </Text>
            </Stack>
          </Box>
        )}
      </Box>
    </div>
  );
}
function getStylesTemplateItem(theme: GrafanaTheme2) {
  return {
    container: css({
      // eslint-disable-next-line
      borderRadius: 24,
      overflow: 'hidden',
      border: '1px solid transparent',

      ':hover': {
        border: '1px solid ' + theme.colors.border.medium,
        cursor: 'pointer',
      },
    }),
    img: css({
      objectFit: 'cover',
      objectPosition: 'top-left',
      minWidth: '100%',
    }),
  };
}
