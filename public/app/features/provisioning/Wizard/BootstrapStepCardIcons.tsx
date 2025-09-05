import { Icon, Stack } from '@grafana/ui';

import { RepoIcon } from '../Shared/RepoIcon';

import { RepoType, Target } from './types';

export function BootstrapStepCardIcons({ target, repoType }: { target: Target; repoType: RepoType }) {
  if (target === 'instance') {
    return (
      <Stack direction="row">
        <Icon name="grafana" size="xxl" />
        <Icon name="arrows-h" size="xxl" />
        <RepoIcon type="github" />
      </Stack>
    );
  }

  if (target === 'folder') {
    return (
      <Stack>
        <RepoIcon type="github" />
        <Icon name="arrow-right" size="xxl" />
        <Icon name="folder" size="xxl" />
      </Stack>
    );
  }

  return null;
}
