import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Badge, Button, Grid, Stack, Text, useStyles2 } from '@grafana/ui';
import { useStoredBoolean } from 'app/core/hooks/useStored';

import { Guide, type GuideProps } from './Guide';

const HOME_GET_STARTED_EXPANDED_LOCAL_STORAGE_KEY = 'grafana.home.get-started.expanded';

export function GetStarted({ guides }: { guides: GuideProps[] }) {
  const styles = useStyles2(getStyles);
  const [expanded, setExpanded] = useStoredBoolean(HOME_GET_STARTED_EXPANDED_LOCAL_STORAGE_KEY, false);

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="row" gap={1} alignItems="center">
        <Text variant="body" element="h3" color="secondary">
          <Trans i18nKey="home.overview.get-started.title">Recommended getting started guides</Trans>
        </Text>
        <Badge text={guides.length} color="darkgrey" className={styles.pill} />
      </Stack>

      <Grid gap={2} columns={{ xs: 1, md: 2, lg: 3 }}>
        {guides.slice(0, expanded ? guides.length : 6).map((guide) => (
          <Guide key={guide.title} {...guide} />
        ))}
      </Grid>

      {guides.length > 6 && (
        <Stack direction="row" justifyContent="center">
          <Button
            type="button"
            variant="secondary"
            fill="text"
            size="md"
            onClick={() => setExpanded(!expanded)}
            icon={expanded ? 'angle-up' : 'angle-down'}
            iconPlacement="right"
            className={styles.button}
          >
            <Stack direction="row" alignItems="center" columnGap={1}>
              {expanded ? (
                <Trans i18nKey="home.overview.get-started.show-less">Show fewer guides</Trans>
              ) : (
                <Trans i18nKey="home.overview.get-started.show-more">More getting started guides</Trans>
              )}
              {!expanded && <Badge text={guides.length - 6} color="darkgrey" className={styles.pill} />}
            </Stack>
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  pill: css({
    borderRadius: theme.shape.radius.pill,
    lineHeight: 1.125,
    padding: theme.spacing(0, 0.5),
  }),
  button: css({
    '&&': {
      color: theme.colors.text.secondary,
      background: 'transparent',
      fontWeight: theme.typography.fontWeightRegular,
    },
    '&&:hover': {
      color: theme.colors.text.link,
    },
  }),
});
