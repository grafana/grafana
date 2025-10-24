import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import {
  Stack,
  Text,
  TextLink,
  CollapsableSection,
  Tooltip,
  Icon,
  ColorPicker,
  useStyles2,
  useTheme2,
} from '@grafana/ui';

import { CatalogPluginInsights, ScoreLevel, InsightLevel, SCORE_LEVELS } from '../types';

type Props = { pluginInsights: CatalogPluginInsights | undefined };

const getColor = (level: ScoreLevel, theme: GrafanaTheme2) => {
  switch (level) {
    case SCORE_LEVELS.EXCELLENT:
      return theme.colors.success.main;
    case SCORE_LEVELS.GOOD:
    case SCORE_LEVELS.FAIR:
      return theme.colors.warning.main;
    case SCORE_LEVELS.POOR:
    case SCORE_LEVELS.CRITICAL:
      return theme.colors.error.main;
    default:
      return theme.colors.border.weak;
  }
};

const getInsightItemColor = (level: InsightLevel) => {
  switch (level) {
    case 'ok':
    case 'good':
    case 'info':
      return 'secondary';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'error';
  }
};

export function PluginInsights(props: Props): React.ReactElement | null {
  const { pluginInsights } = props;
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const tooltipInfo = (
    <Stack direction="column">
      <Stack direction="row" alignItems="center">
        <ColorPicker color={getColor(SCORE_LEVELS.EXCELLENT, theme)} onChange={() => {}} />
        <Text color="secondary" variant="body">
          <Trans i18nKey="plugins.details.labels.pluginInsightsSuccessTooltip">
            All relevant signals are present and verified
          </Trans>
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center">
        <ColorPicker color={getColor(SCORE_LEVELS.FAIR, theme)} onChange={() => {}} />
        <Text color="secondary" variant="body">
          <Trans i18nKey="plugins.details.labels.pluginInsightsWarningTooltip">
            One or more signals are missing or need attention
          </Trans>
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center">
        <ColorPicker color={getColor(SCORE_LEVELS.POOR, theme)} onChange={() => {}} />
        <Text color="secondary" variant="body">
          <Trans i18nKey="plugins.details.labels.pluginInsightsErrorTooltip">Poor or critical data quality</Trans>
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center">
        <ColorPicker color={theme.colors.border.weak} onChange={() => {}} />
        <Text color="secondary" variant="body">
          <Trans i18nKey="plugins.details.labels.pluginInsightsNodataTooltip">
            No available data to determine the status yet
          </Trans>
        </Text>
      </Stack>
      <Text color="secondary" variant="body">
        <Trans i18nKey="plugins.details.labels.moreDetails">
          Plese find more information{' '}
          <TextLink href="https://grafana.com/developers/plugin-tools/" external>
            here
          </TextLink>
          .
        </Trans>
      </Text>
    </Stack>
  );

  return (
    <>
      <Stack direction="column" gap={0.5} shrink={0} grow={0} data-testid="plugin-insights-container">
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Text color="secondary" variant="body" data-testid="plugin-insights-header">
            <Trans i18nKey="plugins.details.labels.pluginInsights.header">Plugin insights</Trans>
          </Text>
          <Tooltip content={tooltipInfo} placement="right-end" interactive>
            <Icon name="info-circle" size="xs" />
          </Tooltip>
        </Stack>
        {pluginInsights?.insights.map((insightItem, index) => {
          return (
            <Stack key={index} wrap direction="column" gap={0.5}>
              <CollapsableSection
                isOpen={false}
                label={
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    data-testid={`plugin-insight-${insightItem.name.toLowerCase()}`}
                  >
                    <ColorPicker
                      color={getColor(insightItem.scoreLevel, theme)}
                      onChange={() => {}}
                      data-testid={`plugin-insight-color-${insightItem.name.toLowerCase()}`}
                    />
                    <Text color="primary" variant="body">
                      {insightItem.name}
                    </Text>
                  </Stack>
                }
                contentClassName={styles.pluginInsightsItems}
              >
                <Stack direction="column" gap={0.5}>
                  {insightItem.items.map((item, idx) => (
                    <Text
                      color={getInsightItemColor(item.level)}
                      variant="body"
                      key={idx}
                      element="li"
                      data-testid={`plugin-insight-item-${item.id}`}
                    >
                      {item.name}
                    </Text>
                  ))}
                </Stack>
              </CollapsableSection>
            </Stack>
          );
        })}
      </Stack>
    </>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    pluginVersionDetails: css({ wordBreak: 'break-word' }),
    pluginInsightsItems: css({ paddingLeft: theme.spacing(2) }),
  };
};
