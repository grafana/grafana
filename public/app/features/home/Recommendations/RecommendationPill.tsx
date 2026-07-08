import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { LinkButton, useStyles2 } from '@grafana/ui';

import type { RecommendationItem } from './Recommendations';

export default function RecommendationPill({ recommendation }: { recommendation: RecommendationItem }) {
  const styles = useStyles2(getStyles, recommendation.color);

  return (
    <LinkButton
      variant="secondary"
      size="sm"
      fill="solid"
      icon={recommendation.icon}
      href={recommendation.href}
      className={styles.pill}
    >
      {recommendation.action}
    </LinkButton>
  );
}

const getStyles = (theme: GrafanaTheme2, color: RecommendationItem['color']) => ({
  pill: css({
    borderRadius: theme.shape.radius.pill,
    border: `1px solid ${theme.colors.border.medium}`,

    '& > svg': {
      color: typeof color === 'function' ? color(theme) : color,
    },
  }),
});
