import { css } from '@emotion/css';

import { locale } from '@grafana/data';
import { useStyles2, Box, Stack, Text } from '@grafana/ui';

import { Template, Link } from './types';

interface TemplateItemProps {
  dashboard: Template;
}
export function TemplateItem({ dashboard }: TemplateItemProps) {
  const getThumbnailUrl = () => {
    const thumbnail = dashboard.screenshots?.[0]?.links.find((l: Link) => l.rel === 'image')?.href ?? '';
    return thumbnail ? `/api/gnet${thumbnail}` : '';
  };

  const styles = useStyles2(getStylesTemplateItem);
  const thumbnailUrl = getThumbnailUrl();

  return (
    <div className={styles.container}>
      <Box display="flex" direction="column" backgroundColor="secondary" paddingBottom={2} height="100%">
        <Box display="flex" height="200px">
          {thumbnailUrl ? (
            <img className={styles.img} src={getThumbnailUrl()} alt="Screenshot" />
          ) : (
            <Box
              backgroundColor="secondary"
              display="flex"
              alignItems="center"
              justifyContent="center"
              flex="1"
              height="200px"
            >
              No image
            </Box>
          )}
        </Box>
        <Box paddingY={1} paddingX={1}>
          <Stack direction="column">
            <Text variant="h4">{dashboard.name}</Text>
            <Text variant="body" color="secondary">
              {dashboard.description}
            </Text>
            <Text variant="body" color="secondary" weight="bold">
              {dashboard.datasource}
            </Text>
          </Stack>
        </Box>
        <Box
          display="flex"
          direction="row"
          paddingX={1}
          alignItems="center"
          justifyContent="space-between"
          minWidth="100%"
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
      </Box>
    </div>
  );
}
function getStylesTemplateItem() {
  return {
    container: css({
      // eslint-disable-next-line
      borderRadius: 24,
      overflow: 'hidden',
    }),
    img: css({
      objectFit: 'cover',
      objectPosition: 'top-left',
      minWidth: '100%',
    }),
  };
}
