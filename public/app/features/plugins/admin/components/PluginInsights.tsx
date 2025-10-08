import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Stack, Text, CollapsableSection, Tooltip, Icon, ColorPicker, useStyles2 } from '@grafana/ui';

import { CatalogPluginInsights, ScoreLevel } from '../types';

type Props = { pluginInsights: CatalogPluginInsights | undefined };

const tooltipInfo = (
  <Stack direction="column">
    <Stack direction="row" alignItems="center">
      <ColorPicker color="#00ff00" onChange={() => {}} />
      <Text color="secondary" variant="body">
        <Trans i18nKey="plugins.details.labels.pluginInsightsSuccessTooltip">
          All relevant signals are present and verified
        </Trans>
      </Text>
    </Stack>
    <Stack direction="row" alignItems="center">
      <ColorPicker color="#FF9830" onChange={() => {}} />
      <Text color="secondary" variant="body">
        <Trans i18nKey="plugins.details.labels.pluginInsightsWarningTooltip">
          One or more signals are missing or need attention
        </Trans>
      </Text>
    </Stack>
    <Stack direction="row" alignItems="center">
      <ColorPicker color="#E02F44" onChange={() => {}} />
      <Text color="secondary" variant="body">
        <Trans i18nKey="plugins.details.labels.pluginInsightsErrorTooltip">Poor or critical data quality</Trans>
      </Text>
    </Stack>
    <Stack direction="row" alignItems="center">
      <ColorPicker color="#ccccdc" onChange={() => {}} />
      <Text color="secondary" variant="body">
        <Trans i18nKey="plugins.details.labels.pluginInsightsNodataTooltip">
          No available data to determine the status yet
        </Trans>
      </Text>
    </Stack>
  </Stack>
);

export function PluginInsights(props: Props): React.ReactElement | null {
  const { pluginInsights } = props;
  const styles = useStyles2(getStyles);
  const getColor = (level: ScoreLevel) => {
    switch (level) {
      case 'Excellent':
        return '#00ff00';
      case 'Good':
      case 'Fair':
        return '#FF9830';
      case 'Poor':
      case 'Critical':
        return '#E02F44';
      default:
        return '#ccccdc';
    }
  };

  return (
    <>
      <Stack direction="column" gap={0.5} shrink={0} grow={0} data-testid="plugin-insights">
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Text color="secondary" variant="body">
            <Trans i18nKey="plugins.details.labels.pluginInsights">Plugin insights</Trans>
          </Text>
          <Tooltip content={tooltipInfo} placement="right-end">
            <Icon name="info-circle" size="xs" />
          </Tooltip>
        </Stack>
        {pluginInsights?.insights.map((insightItem, index) => {
          return (
            <Stack key={index} wrap direction="column" gap={0.5}>
              <CollapsableSection
                isOpen={false}
                label={
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <ColorPicker color={getColor(insightItem.scoreLevel)} onChange={() => {}} />
                    <Text color="primary" variant="body">
                      <Trans i18nKey="plugins.details.labels.pluginInsights">{insightItem.name}</Trans>
                    </Text>
                  </Stack>
                }
                contentClassName={styles.pluginInsightsItems}
              >
                <Stack direction="column" gap={0.5}>
                  {insightItem.items.map((item, idx) => (
                    <Text color="secondary" variant="body" key={idx} element="li">
                      <Trans i18nKey="plugins.details.labels.item">{item.name}</Trans>
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
