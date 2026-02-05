import { OwnerReference as OwnerReferenceType } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { useGetTeamMembersQuery, useGetTeamQuery } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { Trans } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Stack, Text, Link, Tooltip } from '@grafana/ui';

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
        <Text>{team.spec.title}</Text>
      </Tooltip>
    </Link>
  );
};
