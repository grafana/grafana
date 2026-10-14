import { type Team } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { TextLink } from '@grafana/ui';

export function TeamLink({ team }: { team: Team }) {
  return (
    <TextLink color="primary" inline={false} href={`/org/teams/edit/${team.metadata.name}`}>
      {team.spec.title}
    </TextLink>
  );
}
