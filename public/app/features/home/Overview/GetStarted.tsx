import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Badge, Grid, Stack, Text, useStyles2 } from '@grafana/ui';

import { Guide, type GuideProps } from './Guide';

export function GetStarted({ guides }: { guides: GuideProps[] }) {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={1} alignItems="center">
        <Text variant="body" element="h3" color="secondary">
          <Trans i18nKey="home.overview.get-started.title">Recommended getting started guides</Trans>
        </Text>
        <Badge text={guides.length} color="darkgrey" className={styles.pill} />
      </Stack>

      <Grid gap={2} columns={{ xs: 1, md: 2, lg: 3 }}>
        {guides.map((guide) => (
          <Guide key={guide.title} {...guide} />
        ))}
      </Grid>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  pill: css({
    borderRadius: theme.shape.radius.pill,
    lineHeight: 1.125,
    padding: theme.spacing(0, 0.5),
  }),
});
