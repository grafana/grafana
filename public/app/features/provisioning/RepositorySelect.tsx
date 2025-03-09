import { Combobox, Spinner } from '@grafana/ui';
import { ComboboxBaseProps } from '@grafana/ui/src/components/Combobox/Combobox';

import { useListRepositoryQuery } from './api';

export function RepositorySelect(props: Pick<ComboboxBaseProps<string>, 'value' | 'onChange'>) {
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
