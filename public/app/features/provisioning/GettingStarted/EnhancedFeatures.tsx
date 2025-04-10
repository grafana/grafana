import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Stack, Text, LinkButton, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { IconCircle } from './IconCircle';

interface EnhancedFeaturesProps {
  hasPublicAccess: boolean;
  hasImageRenderer: boolean;
  onSetupPublicAccess: () => void;
}

export const EnhancedFeatures = ({ hasPublicAccess, hasImageRenderer, onSetupPublicAccess }: EnhancedFeaturesProps) => {
  const style = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={5}>
      <Stack direction="column">
        <Text variant="h4">
          <Trans i18nKey="provisioning.enhanced-features.header">Enhance your GitHub experience</Trans>
        </Text>
        <Text color="secondary">
          <Trans i18nKey="provisioning.enhanced-features.description">
            Get the most out of your GitHub integration with these optional add-ons
          </Trans>
        </Text>
      </Stack>
      <Stack gap={2} direction="row" height="100%">
        <Box width="40%" height="100%" display="flex" direction="column" gap={2} alignItems="flex-start">
          <Stack gap={2}>
            <IconCircle icon="sync" color="blue" />
            <IconCircle icon="code-branch" color="purple" />
          </Stack>
          <Trans i18nKey="provisioning.enhanced-features.title-instant-updates-requests-webhooks">
            Instant updates and pull requests with webhooks.
          </Trans>
          <Box display="flex" flex="1" minHeight="50px">
            <Text variant="body" color="secondary">
              <Trans i18nKey="provisioning.enhanced-features.description-instant-updates">
                Get instant updates in Grafana as soon as changes are committed. Review and approve changes using pull
                requests before they go live.
              </Trans>
            </Text>
          </Box>
          <LinkButton
            fill="outline"
            variant="secondary"
            onClick={onSetupPublicAccess}
            disabled={hasPublicAccess}
            icon={hasPublicAccess ? 'check' : undefined}
          >
            <Trans i18nKey="provisioning.enhanced-features.set-up-public-webhooks">Set up public webhooks</Trans>
          </LinkButton>
        </Box>

        <div className={style.separator} />

        <Box
          width="40%"
          height="100%"
          paddingLeft={2}
          display="flex"
          direction="column"
          gap={2}
          alignItems="flex-start"
        >
          <IconCircle icon="camera" color="orange" />
          <Trans i18nKey="provisioning.enhanced-features.title-visual-previews-in-pull-requests">
            Visual previews in pull requests with image rendering
          </Trans>
          <Box display="flex" flex="1" minHeight="50px">
            <Text variant="body" color="secondary">
              <Trans i18nKey="provisioning.enhanced-features.description-visual-previews-dashboard-updates-directly-requests">
                See visual previews of dashboard updates directly in pull requests
              </Trans>
            </Text>
          </Box>
          <LinkButton
            fill="outline"
            variant="secondary"
            href="https://grafana.com/grafana/plugins/grafana-image-renderer/"
            icon={hasImageRenderer ? 'check' : 'external-link-alt'}
            disabled={hasImageRenderer}
          >
            <Trans i18nKey="provisioning.enhanced-features.set-up-image-rendering">Set up image rendering</Trans>
          </LinkButton>
        </Box>
      </Stack>
    </Stack>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    separator: css({
      borderRight: `2px solid ${theme.colors.border.weak}`,
    }),
  };
}
