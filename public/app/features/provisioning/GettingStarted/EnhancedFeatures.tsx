import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Stack, Text, LinkButton, Icon, IconName, useStyles2 } from '@grafana/ui';

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

export const EnhancedFeatures = ({ hasPublicAccess, hasImageRenderer, onSetupPublicAccess }: EnhancedFeaturesProps) => {
  const style = useStyles2(getStyles);

  return (
    <Box marginTop={2}>
      <Text variant="h2">Unlock enhanced functionality for GitHub</Text>
      <Box marginTop={4}>
        <Stack direction="row" gap={2}>
          <FeatureCard
            title="Instant updates and pull requests with webhooks"
            description="Get instant updates in Grafana as soon as changes are committed. Review and approve changes using pull requests before they go live."
            icon={<IconCircle icon="sync" color="primary" background="rgba(24, 121, 219, 0.12)" />}
            action={
              !hasPublicAccess && (
                <LinkButton fill="outline" onClick={onSetupPublicAccess}>
                  Set up public access
                </LinkButton>
              )
            }
          />

          <div className={style.separator} />

          <FeatureCard
            title="Visual previews in pull requests"
            description="See visual previews of dashboard updates directly in pull requests"
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
};

function getStyles(theme: GrafanaTheme2) {
  return {
    separator: css({
      borderRight: `2px solid ${theme.colors.border.weak}`,
    }),
  };
}
