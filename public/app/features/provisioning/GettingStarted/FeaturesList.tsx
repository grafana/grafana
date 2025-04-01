import { ReactNode } from 'react';

import { Stack, Text, Box, LinkButton, Icon } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning';
import { Trans } from 'app/core/internationalization';

import { ConnectRepositoryButton } from '../Shared/ConnectRepositoryButton';

interface FeatureItemProps {
  children: NonNullable<ReactNode>;
}

const FeatureItem = ({ children }: FeatureItemProps) => {
  // We use a stack here to ensure the icon and text are aligned correctly.
  return (
    <Stack direction="row" gap={1}>
      <Icon name="check" className="text-success" />
      <Text variant="body">{children}</Text>
    </Stack>
  );
};

interface FeaturesListProps {
  repos?: Repository[];
  hasPublicAccess: boolean;
  hasImageRenderer: boolean;
  hasRequiredFeatures: boolean;
  onSetupFeatures: () => void;
}

export const FeaturesList = ({
  repos,
  hasPublicAccess,
  hasImageRenderer,
  hasRequiredFeatures,
  onSetupFeatures,
}: FeaturesListProps) => {
  const actions = () => {
    if (!hasRequiredFeatures) {
      return (
        <Box>
          <LinkButton fill="outline" onClick={onSetupFeatures}>
            <Trans i18nKey="provisioning.features-list.actions.set-up-required-feature-toggles">
              Set up required feature toggles
            </Trans>
          </LinkButton>
        </Box>
      );
    }

    return (
      <Stack direction="row" alignItems="center" gap={2}>
        <ConnectRepositoryButton items={repos} />
      </Stack>
    );
  };

  return (
    <Stack direction="column" gap={2}>
      <Text variant="h2">
        <Trans i18nKey="provisioning.features-list.manage-your-dashboards-with-remote-provisioning">
          Manage your dashboards with remote provisioning
        </Trans>
      </Text>
      <FeatureItem>
        <Trans i18nKey="provisioning.features-list.manage-dashboards-provision-updates-automatically">
          Manage dashboards as code and provision updates automatically
        </Trans>
      </FeatureItem>
      <FeatureItem>
        <Trans i18nKey="provisioning.features-list.store-dashboards-in-version-controlled-storage">
          Store dashboards in version-controlled storage for better organization and history tracking
        </Trans>
      </FeatureItem>
      <FeatureItem>
        <Trans i18nKey="provisioning.features-list.migrate-existing-dashboards-storage-provisioning">
          Migrate existing dashboards to storage for provisioning
        </Trans>
      </FeatureItem>
      {hasPublicAccess && (
        <FeatureItem>
          <Trans i18nKey="provisioning.features-list.automatically-provision-and-update-dashboards">
            Automatically provision and update your dashboards as soon as changes are pushed to your GitHub repository
          </Trans>
        </FeatureItem>
      )}
      {hasImageRenderer && hasPublicAccess && (
        <FeatureItem>
          <Trans i18nKey="provisioning.features-list.visual-previews-in-pull-requests">
            Visual previews in pull requests to review your changes before going live
          </Trans>
        </FeatureItem>
      )}

      {false && (
        // We haven't gotten the design for this quite yet.
        <LinkButton fill="text" href="#" icon="external-link-alt">
          <Trans i18nKey="provisioning.features-list.learn-more">Learn more</Trans>
        </LinkButton>
      )}

      {actions()}
    </Stack>
  );
};
