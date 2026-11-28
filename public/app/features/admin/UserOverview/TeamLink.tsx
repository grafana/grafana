import { TextLink } from '@grafana/ui';

import { type UserTeam } from './hooks';

export function TeamLink({ team }: { team: UserTeam }) {
  return (
    <TextLink color="primary" inline={false} href={`/org/teams/edit/${team.uid}`}>
      {team.name}
    </TextLink>
  );
}
