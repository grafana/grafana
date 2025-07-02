import React from 'react';

import { Trans } from '@grafana/i18n';
import { Stack, Icon, Button, Box } from '@grafana/ui';

interface PullRequestLinkProps {
  url: string;
}

export const PullRequestLink: React.FC<PullRequestLinkProps> = ({ url }) => {
  const handleClick = () => {
    window.open(url, '_blank');
  };

  return (
    <Box display="flex" alignItems="center">
        <Button variant="secondary" onClick={handleClick} type="button">
            <Stack alignItems="center" gap={0.5}>
                <Trans i18nKey="dashboard-scene.dashboard-preview-banner.view-pull-request-in-git-hub">
                    View pull request in GitHub
                </Trans>
                <Icon name="external-link-alt" />
            </Stack>
        </Button>
    </Box>
  );
};
