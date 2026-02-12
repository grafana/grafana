import { Team } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { reportInteraction } from '@grafana/runtime';
import { Text, Link } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

/**
 * Display a team owner reference as a link to team details page
 */
export const OwnerReference = ({ team }: { team: Team }) => {
  const isAdmin = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;
  if (!isAdmin) {
    return <Text>{team.spec.title}</Text>;
  }
  return (
    <Link
      href={`/org/teams/edit/${team.metadata.name}/members`}
      key={team.metadata.name}
      onClick={() => reportInteraction('grafana_owner_reference_link_clicked')}
    >
      <Text>{team.spec.title}</Text>
    </Link>
  );
};
