import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, Box, LinkButton, useStyles2 } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';
import { Trans } from 'app/core/internationalization';

import { ConnectRepositoryButton } from '../Shared/ConnectRepositoryButton';

interface FeaturesListProps {
  repos?: Repository[];
  hasRequiredFeatures: boolean;
  onSetupFeatures: () => void;
}

export const FeaturesList = ({ repos, hasRequiredFeatures, onSetupFeatures }: FeaturesListProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="column" gap={3}>
      <Text variant="h2">
        <Trans i18nKey="provisioning.features-list.manage-your-dashboards-with-remote-provisioning">
          Get started with GitSync
        </Trans>
      </Text>
      <ul className={styles.featuresList}>
        <li>
          <Trans i18nKey="provisioning.features-list.manage-dashboards-provision-updates-automatically">
            Manage dashboards as code in GitHub and provision updates automatically
          </Trans>
        </li>
        <li>
          <Trans i18nKey="provisioning.features-list.store-dashboards-in-version-controlled-storage">
            Store dashboards in version-controlled storage for better organization and history tracking
          </Trans>
        </li>
        <li>
          <Trans i18nKey="provisioning.features-list.migrate-existing-dashboards-storage-provisioning">
            Migrate existing dashboards to GitHub for provisioning
          </Trans>
        </li>
      </ul>
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
          <ConnectRepositoryButton items={repos} />
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
