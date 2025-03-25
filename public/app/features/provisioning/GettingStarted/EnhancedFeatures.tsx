import { css } from '@emotion/css';

import { Box, Stack, Text, LinkButton, Icon, IconName } from '@grafana/ui';

import { FeatureCard } from './FeatureCard';

interface IconCircleProps {
  icon: string;
  color: string;
  background: string;
}

const IconCircle = ({ icon, color, background }: IconCircleProps) => (
  <div
    className={css({
      background: `${background}`,
      borderRadius: `50%`,
      padding: `16px`,
      width: `fit-content`,
    })}
  >
    <Icon name={icon as IconName} size="xxl" color={color} />
  </div>
);

interface EnhancedFeaturesProps {
  hasPublicAccess: boolean;
  hasImageRenderer: boolean;
  onSetupPublicAccess: () => void;
}

export const EnhancedFeatures = ({ hasPublicAccess, hasImageRenderer, onSetupPublicAccess }: EnhancedFeaturesProps) => (
  <Box marginTop={2}>
    <Text variant="h2">Unlock enhanced functionality for GitHub</Text>
    <Box marginTop={4}>
      <Stack direction="row" gap={2}>
        <FeatureCard
          title="Instantenous provisioning"
          description="Automatically provision and update your dashboards as soon as changes are pushed to your GitHub repository"
          icon={<IconCircle icon="sync" color="primary" background="rgba(24, 121, 219, 0.12)" />}
          action={
            !hasPublicAccess && (
              <LinkButton fill="outline" onClick={onSetupPublicAccess}>
                Set up public access
              </LinkButton>
            )
          }
          showBorder
        />
        <FeatureCard
          title="Visual previews in pull requests"
          description="Review how your changes look like before going live in Grafana and directly in pull requests"
          icon={
            <Stack direction="row" gap={2}>
              <IconCircle icon="camera" color="orange" background="rgba(255, 120, 10, 0.12)" />
              <IconCircle icon="code-branch" color="purple" background="rgba(135, 73, 237, 0.12)" />
            </Stack>
          }
          action={
            !hasImageRenderer && (
              <LinkButton
                fill="outline"
                href="https://grafana.com/grafana/plugins/grafana-image-renderer/"
                icon="external-link-alt"
              >
                Set up image rendering
              </LinkButton>
            )
          }
        />
      </Stack>
    </Box>
  </Box>
);
