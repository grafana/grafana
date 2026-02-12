import { Team } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { reportInteraction } from '@grafana/runtime';
import { Text, Link } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

/**
 * Display a team owner reference as a link to team details page
 */
export const OwnerReference = ({ team }: { team: Team }) => {
  // Check if the user is admin, because this is the quickest way (for now)
  // to be sure that they'll definitely be able to view the team details page in question
  // In the future, we'll check the access control permissions for the specific team in question
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
