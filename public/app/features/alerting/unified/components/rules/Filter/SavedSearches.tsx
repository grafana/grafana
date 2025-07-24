import { useCallback } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Badge, Button, InteractiveTable, Stack } from '@grafana/ui';

import MoreButton from '../../MoreButton';

type TableColumns = {
  name: string;
  default?: boolean;
};

export const SavedSearches = () => {
  const applySearch = useCallback((name: string) => {}, []);

  return (
    <Stack direction="column" gap={2} alignItems="flex-end">
      <Button variant="secondary" size="sm">
        <Trans i18nKey="alerting.search.save-query">Save current search</Trans>
      </Button>
      <InteractiveTable<TableColumns>
        columns={[
          {
            id: 'name',
            header: 'Saved search name',
            cell: ({ row }) => (
              <Stack alignItems="center">
                {row.original.name}
                {row.original.default ? (
                  <Badge text={t('alerting.saved-searches.text-default', 'Default')} color="blue" />
                ) : null}
              </Stack>
            ),
          },
          {
            id: 'actions',
            cell: ({ row }) => (
              <Stack direction="row" alignItems="center">
                <Button variant="secondary" fill="outline" size="sm" onClick={() => applySearch(row.original.name)}>
                  <Trans i18nKey="common.apply">Apply</Trans>
                </Button>
                <MoreButton size="sm" fill="outline" />
              </Stack>
            ),
          },
        ]}
        data={[
          {
            name: 'My saved search',
            default: true,
          },
          {
            name: 'Another saved search',
          },
          {
            name: 'This one has a really long name and some emojis too 🥒',
          },
        ]}
        getRowId={(row) => row.name}
      />
      <Button variant="secondary">
        <Trans i18nKey="common.close">Close</Trans>
      </Button>
    </Stack>
  );
};
