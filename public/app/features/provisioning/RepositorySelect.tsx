import { Combobox, ComboboxOption, Spinner } from '@grafana/ui';
import { useListRepositoryQuery } from 'app/api/clients/provisioning';

interface Props {
  value: string;
  onChange: (value: ComboboxOption) => void;
}
export function RepositorySelect(props: Props) {
  const listQuery = useListRepositoryQuery({});

  if (listQuery.isLoading) {
    return <Spinner />;
  }

  return (
    <Combobox
      {...props}
      placeholder={'Select a repository'}
      options={
        listQuery.data?.items?.map((repo) => ({
          label: repo.spec?.title,
          value: repo.metadata?.name ?? '',
        })) || []
      }
    />
  );
}
