import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';

import type { RecommendationItem } from './Recommendations';

export default function RecommendationCard({ recommendation }: { recommendation: RecommendationItem }) {
  const styles = useStyles2(getStyles, recommendation.color);

  return (
    <Stack direction="column" justifyContent="space-between" gap={2}>
      <Stack direction="column" gap={2}>
        <Text element="h3" variant="h3" color="primary">
          {recommendation.title}
        </Text>

        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name={recommendation.icon} className={styles.icon} />
          <Text variant="body" color="secondary">
            {recommendation.context}
          </Text>
        </Stack>

        <Text variant="body">{recommendation.description}</Text>
      </Stack>

      <Stack direction="row" alignItems="center" gap={1}>
        <LinkButton
          variant="primary"
          size="md"
          fill="solid"
          icon="arrow-right"
          iconPlacement="right"
          href={recommendation.href}
        >
          {recommendation.action}
        </LinkButton>
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2, color: RecommendationItem['color']) => ({
  icon: css({
    color: typeof color === 'function' ? color(theme) : color,
  }),
});
