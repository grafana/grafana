import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Stack, Text, TextLink, CollapsableSection, Tooltip, Icon, useStyles2, useTheme2 } from '@grafana/ui';

import { CatalogPluginInsights } from '../types';

type Props = { pluginInsights: CatalogPluginInsights | undefined };

const PLUGINS_INSIGHTS_OPENED_EVENT_NAME = 'plugins_insights_opened';

export function PluginInsights(props: Props): React.ReactElement | null {
  const { pluginInsights } = props;
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [openInsights, setOpenInsights] = useState<Record<string, boolean>>({});

  const handleInsightToggle = (insightName: string, isOpen: boolean) => {
    if (isOpen) {
      reportInteraction(PLUGINS_INSIGHTS_OPENED_EVENT_NAME, { insight: insightName });
    }
    setOpenInsights((prev) => ({ ...prev, [insightName]: isOpen }));
  };

  const tooltipInfo = (
    <Stack direction="column" gap={0.5}>
      <Stack direction="row" alignItems="center">
        <Icon name="check-circle" size="md" color={theme.colors.success.main} />
        <Text color="primary" variant="body">
          <Trans i18nKey="plugins.details.labels.pluginInsightsSuccessTooltip">
            All relevant signals are present and verified
          </Trans>
        </Text>
      </Stack>
      <Stack direction="row" alignItems="center">
        <Icon name="exclamation-triangle" size="md" />
        <Text color="primary" variant="body">
          <Trans i18nKey="plugins.details.labels.pluginInsightsWarningTooltip">
            One or more signals are missing or need attention
          </Trans>
        </Text>
      </Stack>
      <hr className={styles.pluginInsightsTooltipSeparator} />
      <Text color="secondary" variant="body">
        <Trans i18nKey="plugins.details.labels.moreDetails">
          Do you find Plugin Insights usefull? Please share your feedback{' '}
          <TextLink href="https://forms.gle/1ZVLbecyQ8aY9mDYA" external>
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
          <Text color="secondary" variant="h6" data-testid="plugin-insights-header">
            <Trans i18nKey="plugins.details.labels.pluginInsights.header">Plugin insights</Trans>
          </Text>
          <Tooltip content={tooltipInfo} placement="right-end" interactive>
            <Icon name="info-circle" size="md" />
          </Tooltip>
        </Stack>
        {pluginInsights?.insights.map((insightItem, index) => {
          return (
            <Stack key={index} wrap direction="column" gap={1}>
              <CollapsableSection
                isOpen={openInsights[insightItem.name] ?? false}
                onToggle={(isOpen) => handleInsightToggle(insightItem.name, isOpen)}
                label={
                  <Stack
                    direction="row"
                    gap={1}
                    alignItems="center"
                    data-testid={`plugin-insight-${insightItem.name.toLowerCase()}`}
                  >
                    {insightItem.scoreLevel === 'Excellent' ? (
                      <Icon
                        name="check-circle"
                        size="lg"
                        color={theme.colors.success.main}
                        data-testid="excellent-icon"
                      />
                    ) : (
                      <Icon name="exclamation-triangle" size="lg" data-testid="poor-icon" />
                    )}
                    <Text
                      color="primary"
                      variant="body"
                      data-testid={`plugin-insight-color-${insightItem.name.toLowerCase()}`}
                    >
                      {capitalize(insightItem.name)}
                    </Text>
                  </Stack>
                }
                contentClassName={styles.pluginInsightsItems}
              >
                <Stack direction="column" gap={1}>
                  {insightItem.items.map((item, idx) => (
                    <Stack key={idx} direction="row" gap={1} alignItems="flex-start">
                      <span>
                        {item.level === 'good' ? (
                          <Icon name="check-circle" size="sm" color={theme.colors.success.main} />
                        ) : (
                          <Icon name="exclamation-triangle" size="sm" />
                        )}
                      </span>
                      <Text color="secondary" variant="body" data-testid={`plugin-insight-item-${item.id}`}>
                        {item.name}
                      </Text>
                    </Stack>
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
    pluginInsightsItems: css({ marginLeft: '26px', paddingTop: '0 !important' }),
    pluginInsightsTooltipSeparator: css({
      border: 'none',
      borderTop: `1px solid ${theme.colors.border.medium}`,
      margin: `${theme.spacing(1)} 0`,
    }),
  };
};
