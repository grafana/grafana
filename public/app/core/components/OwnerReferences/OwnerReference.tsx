import { OwnerReference as OwnerReferenceType } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { useGetTeamMembersQuery, useGetTeamQuery } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Stack, Text, Link, Tooltip } from '@grafana/ui';

/**
 * Display a team owner reference, with additional information about the team members.
 */
const OwnerReference = ({
  ownerReference,
  compact = false,
}: {
  ownerReference: OwnerReferenceType;
  compact?: boolean;
}) => {
  const { data: team, isLoading: isLoadingTeam } = useGetTeamQuery({ name: ownerReference.uid });
  const { data: teamMembers } = useGetTeamMembersQuery({ name: ownerReference.uid });

  const membersTooltip = (
    <>
      <Stack gap={1} direction="column">
        {compact && <Text variant="h6">{ownerReference.name}</Text>}
        <Text>
          <Trans i18nKey="owner-reference.team-members">Team members:</Trans>
        </Text>
        {teamMembers?.items?.map((member) => (
          <div key={member.identity.name}>{member.displayName}</div>
        ))}
      </Stack>
    </>
  );

  if (isLoadingTeam || !team) {
    return null;
  }

  return (
    <Link
      href={`/org/teams/edit/${ownerReference.uid}/members`}
      key={ownerReference.uid}
      onClick={() => reportInteraction('grafana_owner_reference_link_clicked')}
    >
      <Tooltip content={membersTooltip}>
        <Stack gap={1} alignItems="center">
          {team.spec.title}
        </Stack>
      </Tooltip>
    </Link>
  );
};

/**
 * Display a list of team owner references
 */
export const TeamOwnerReferences = ({ ownerReferences }: { ownerReferences: OwnerReferenceType[] }) => {
  if (!ownerReferences || ownerReferences.length === 0) {
    return null;
  }

  if (ownerReferences.length === 1) {
    const ref = ownerReferences[0];
    return <OwnerReference ownerReference={ref} />;
  }

  return ownerReferences.map((ref) => <OwnerReference ownerReference={ref} compact key={ref.uid} />);
};
