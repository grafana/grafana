import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Stack, Text, LinkButton, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { FeatureCard } from './FeatureCard';
import { IconCircle } from './IconCircle';

interface EnhancedFeaturesProps {
  hasPublicAccess: boolean;
  hasImageRenderer: boolean;
  onSetupPublicAccess: () => void;
}

export const EnhancedFeatures = ({ hasPublicAccess, hasImageRenderer, onSetupPublicAccess }: EnhancedFeaturesProps) => {
  const style = useStyles2(getStyles);

  return (
    <Box marginTop={2}>
      <Text variant="h4">
        <Trans i18nKey="provisioning.enhanced-features.header">Enhance your GitHub experience</Trans>
      </Text>
      <Box marginTop={4}>
        <Stack gap={2}>
          <FeatureCard
            title={t(
              'provisioning.enhanced-features.title-instant-updates-requests-webhooks',
              'Instant updates and pull requests with webhooks.'
            )}
            description={t(
              'provisioning.enhanced-features.description-instant-updates',
              'Get instant updates in Grafana as soon as changes are committed. Review and approve changes using pull requests before they go live.'
            )}
            icon={
              <Stack gap={2}>
                <IconCircle icon="sync" color="blue" />
                <IconCircle icon="code-branch" color="purple" />
              </Stack>
            }
            action={
              !hasPublicAccess && (
                <LinkButton fill="outline" variant="secondary" onClick={onSetupPublicAccess}>
                  <Trans i18nKey="provisioning.enhanced-features.set-up-public-webhooks">Set up public webhooks</Trans>
                </LinkButton>
              )
            }
          />

          <div className={style.separator} />

          <FeatureCard
            title={t(
              'provisioning.enhanced-features.title-visual-previews-in-pull-requests',
              'Visual previews in pull requests with image rendering'
            )}
            description={t(
              'provisioning.enhanced-features.description-visual-previews-dashboard-updates-directly-requests',
              'See visual previews of dashboard updates directly in pull requests'
            )}
            icon={<IconCircle icon="camera" color="orange" />}
            action={
              <LinkButton
                fill="outline"
                variant="secondary"
                href="https://grafana.com/grafana/plugins/grafana-image-renderer/"
                icon="external-link-alt"
              >
                <Trans i18nKey="provisioning.enhanced-features.set-up-image-rendering">Set up image rendering</Trans>
              </LinkButton>
            }
          />
        </Stack>
      </Box>
    </Box>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    separator: css({
      borderRight: `2px solid ${theme.colors.border.weak}`,
    }),
  };
}
