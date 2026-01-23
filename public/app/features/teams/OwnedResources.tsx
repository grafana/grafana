import { useListFolderQuery } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { Stack, Text, Link, Icon } from '@grafana/ui';
import { Team } from 'app/types/teams';

export const OwnedResources = ({ team }: { team: Team }) => {
  const { data } = useListFolderQuery({});
  const ownedFolders = data?.items.filter((folder) =>
    folder.metadata.ownerReferences?.some((ref) => ref.uid === team.uid)
  );
  return (
    <Stack gap={1} direction="column">
      <Text variant="h3">Owned folders:</Text>
      {ownedFolders &&
        ownedFolders.map((folder) => (
          <div key={folder.metadata.uid}>
            <Link href={`/dashboards/f/${folder.metadata.name}`}>
              <Icon name="folder" /> <Text>{folder.spec.title}</Text>
            </Link>
          </div>
        ))}
    </Stack>
  );
};
