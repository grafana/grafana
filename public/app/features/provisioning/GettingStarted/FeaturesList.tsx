import { css } from '@emotion/css';

import { FeatureState, GrafanaTheme2 } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Box, FeatureBadge, LinkButton, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

import { RepositoryTypeCards } from '../Shared/RepositoryTypeCards';

interface FeaturesListProps {
  hasRequiredFeatures: boolean;
  onSetupFeatures: () => void;
}

export const FeaturesList = ({ hasRequiredFeatures, onSetupFeatures }: FeaturesListProps) => {
  const styles = useStyles2(getStyles);
  const isOnPrem = [GrafanaEdition.OpenSource, GrafanaEdition.Enterprise].includes(config.buildInfo.edition);

  return (
    <Stack direction="column" gap={3}>
      <Text variant="h2">
        <Trans i18nKey="provisioning.features-list.manage-your-dashboards-with-remote-provisioning">
          Get started with Git Sync
        </Trans>{' '}
        {!isOnPrem && <FeatureBadge featureState={FeatureState.privatePreview} />}
      </Text>
      <ul className={styles.featuresList}>
        <li>
          <Trans i18nKey="provisioning.features-list.manage-dashboards-provision-updates-automatically">
            Manage dashboards as code in Git and provision updates automatically
          </Trans>
        </li>
        <li>
          <Trans i18nKey="provisioning.features-list.store-dashboards-in-version-controlled-storage">
            Store dashboards in version-controlled storage for better organization and history tracking
          </Trans>
        </li>
      </ul>
      <Text>
        <Trans i18nKey="provisioning.features-list.learn-more-documentation">
          Want to learn more? See our{' '}
          <TextLink
            external
            href={
              'https://grafana.com/docs/grafana-cloud/developer-resources/observability-as-code/provision-resources'
            }
          >
            documentation
          </TextLink>
          .
        </Trans>
      </Text>
      {!hasRequiredFeatures ? (
        <Box>
          <LinkButton fill="outline" onClick={onSetupFeatures}>
            <Trans i18nKey="provisioning.features-list.actions.set-up-required-feature-toggles">
              Set up required feature toggles
            </Trans>
          </LinkButton>
        </Box>
      ) : (
        <Stack direction="row" alignItems="center" gap={2}>
          <RepositoryTypeCards />
        </Stack>
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    featuresList: css({
      listStyleType: 'none',
      paddingLeft: 0,
      marginLeft: theme.spacing(-1),
      '& li': {
        position: 'relative',
        paddingLeft: theme.spacing(4),
        marginBottom: theme.spacing(1),
        '&:before': {
          content: '"✓"',
          position: 'absolute',
          left: theme.spacing(1),
          top: '0',
          color: theme.colors.text.secondary,
          fontWeight: theme.typography.fontWeightBold,
        },
      },
    }),
  };
};
