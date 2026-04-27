import { css } from '@emotion/css';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { Trans } from '@grafana/i18n';
import { Box, LinkButton, Stack, Text, TextLink } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { QuotaLimitMessage } from '../Shared/QuotaLimitMessage';
import { RepositoryTypeCards } from '../Shared/RepositoryTypeCards';

interface FeaturesListProps {
  hasRequiredFeatures: boolean;
  isConnectionLimitExceeded?: boolean;
  maxRepositories?: number;
  onSetupFeatures: () => void;
}

export const FeaturesList = ({
  hasRequiredFeatures,
  isConnectionLimitExceeded,
  maxRepositories = 0,
  onSetupFeatures,
}: FeaturesListProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={3}>
      <Text variant="h2">
        <Trans i18nKey="provisioning.features-list.manage-your-dashboards-with-remote-provisioning">
          Get started with Git Sync
        </Trans>
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
        {!!maxRepositories && (
          <li>
            <QuotaLimitMessage maxRepositories={maxRepositories} showActionLink={false} />
          </li>
        )}
      </ul>
      <Text>
        <Trans i18nKey="provisioning.features-list.learn-more-documentation">
          Want to learn more? See our{' '}
          <TextLink external href={'https://grafana.com/docs/grafana/latest/as-code/observability-as-code/git-sync/'}>
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
          <RepositoryTypeCards disabled={isConnectionLimitExceeded} />
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
