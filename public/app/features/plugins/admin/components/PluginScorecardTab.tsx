import { css } from '@emotion/css';
import { capitalize } from 'lodash';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, type BadgeColor, Icon, Stack, Text, TextLink, useStyles2, useTheme2 } from '@grafana/ui';

import { type CatalogPlugin, type CatalogPluginInsights } from '../types';

const DIMENSION_DESCRIPTIONS: Record<string, string> = {
  safety:
    'Checks for known vulnerabilities in dependencies, dangerous code patterns in the plugin source, and supply chain hygiene in the CI/CD pipeline.',
  quality:
    'Checks for good development practices including code review, automated testing, static analysis, licensing, and a documented security policy.',
  community:
    'Checks signals that indicate how actively the plugin is maintained and supported, including recent commit activity, contributor breadth, and adoption.',
};

function scoreLevelToBadgeColor(level: string): BadgeColor {
  switch (level) {
    case 'Excellent':
      return 'green';
    case 'Good':
      return 'green';
    case 'Fair':
      return 'orange';
    default:
      return 'red';
  }
}

function overallScore(insights: CatalogPluginInsights): number {
  const dims = insights.insights?.filter(
    (d) => typeof d.scoreValue === 'number' && !isNaN(d.scoreValue) && d.scoreValue > 0
  );
  if (!dims?.length) {
    return 0;
  }
  return Math.round(dims.reduce((sum, d) => sum + d.scoreValue, 0) / dims.length);
}

type Props = {
  plugin: CatalogPlugin;
};

export function PluginScorecardTab({ plugin }: Props): React.ReactElement {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const insights = plugin.insights;

  if (!insights?.insights?.length) {
    return (
      <Alert severity="warning" title={t('plugins.scorecard-tab.no-data-title', 'No scorecard data available')}>
        <Trans i18nKey="plugins.scorecard-tab.no-data-body">
          No security scorecard data is available for this plugin. Review the source code directly before installing and
          proceed with caution.
        </Trans>
      </Alert>
    );
  }

  const total = overallScore(insights);

  return (
    <div className={styles.container}>
      <div className={styles.overallScore}>
        {t('plugins.scorecard-tab.overall-score', 'Scorecard score: {{score}}/100', { score: total })}
      </div>

      {insights.insights.map((dim) => {
        const description = DIMENSION_DESCRIPTIONS[dim.name] ?? '';
        const badgeColor = scoreLevelToBadgeColor(dim.scoreLevel);
        return (
          <div key={dim.name} className={styles.dimension}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Text variant="h5" color="primary">
                {capitalize(dim.name)}
              </Text>
              <Badge color={badgeColor} text={dim.scoreLevel} />
            </Stack>

            {description && <Text color="secondary">{description}</Text>}

            {dim.items?.length > 0 ? (
              <div className={styles.items}>
                {dim.items.map((item, idx) => (
                  <div key={idx} className={styles.item}>
                    <Icon
                      name={item.level === 'good' ? 'check-circle' : 'exclamation-triangle'}
                      size="sm"
                      color={item.level === 'good' ? theme.colors.success.main : theme.colors.warning.main}
                    />
                    {item.link ? (
                      <TextLink href={item.link} external>
                        {item.name}
                      </TextLink>
                    ) : (
                      <Text color="secondary">{item.name}</Text>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.allGood}>
                <Icon name="check-circle" size="sm" color={theme.colors.success.main} />
                <Text color="secondary">
                  <Trans i18nKey="plugins.scorecard-tab.all-checks-passing">All checks passing</Trans>
                </Text>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
    maxWidth: '600px',
  }),
  overallScore: css({
    fontSize: theme.typography.h5.fontSize,
  }),
  dimension: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  items: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    paddingLeft: theme.spacing(1),
  }),
  item: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  allGood: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    paddingLeft: theme.spacing(1),
  }),
});
