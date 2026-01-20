import { OwnerReference } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { useGetTeamQuery, useGetTeamMembersQuery } from '@grafana/api-clients/rtkq/iam/v0alpha1';
import { Trans } from '@grafana/i18n';
import { Stack, Text, Avatar, Link, Tooltip } from '@grafana/ui';

export const getGravatarUrl = (text: string) => {
  // todo
  return `avatar/bd38b9ecaf6169ca02b848f60a44cb95`;
};

export const TeamOwnerReference = ({ ownerReference }: { ownerReference: OwnerReference }) => {
  const { data: team } = useGetTeamQuery({ name: ownerReference.uid });
  const { data: teamMembers } = useGetTeamMembersQuery({ name: ownerReference.uid });

  const teamName = team?.spec?.title || ownerReference.name;
  const avatarURL = getGravatarUrl(teamName);

  const membersTooltip = (
    <>
      <Stack gap={1} direction="column">
        <Text>
          <Trans i18nKey="folder-owner-reference-label">Team members:</Trans>
        </Text>
        {teamMembers?.items?.map((member) => (
          <div key={member.identity.name}>
            <Avatar src={member.avatarURL} /> {member.displayName}
          </div>
        ))}
      </Stack>
    </>
  );

  return (
    <Link href={`/org/teams/edit/${ownerReference.uid}/members`} key={ownerReference.uid}>
      <Tooltip content={membersTooltip}>
        <Stack gap={1} alignItems="center">
          <Avatar src={avatarURL} alt={teamName} /> {teamName}
        </Stack>
      </Tooltip>
    </Link>
  );
};
