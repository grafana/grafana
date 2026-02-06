import { OwnerReference as OwnerReferenceType } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { useGetTeamQuery } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { reportInteraction } from '@grafana/runtime';
import { Text, Link } from '@grafana/ui';

/**
 * Display a team owner reference, with additional information about the team members.
 */
export const OwnerReference = ({
  ownerReference,
  compact = false,
}: {
  ownerReference: OwnerReferenceType;
  compact?: boolean;
}) => {
  const { data: team, isLoading: isLoadingTeam } = useGetTeamQuery({ name: ownerReference.uid });

  if (isLoadingTeam || !team) {
    return null;
  }

  return (
    <Link
      href={`/org/teams/edit/${ownerReference.uid}/members`}
      key={ownerReference.uid}
      onClick={() => reportInteraction('grafana_owner_reference_link_clicked')}
    >
      <Text>{team.spec.title}</Text>
    </Link>
  );
};
