import { css } from '@emotion/css';
import React from 'react';

import { InteractiveTable, CellProps, Stack, Text, Icon, useStyles2, Button } from '@grafana/ui';
import { getSvgSize } from '@grafana/ui/src/components/Icon/utils';
import { t } from 'app/core/internationalization';

import { MigrationResourceDTO } from '../api';

interface ResourcesTableProps {
  resources: MigrationResourceDTO[];
}

const columns = [
  { id: 'name', header: 'Name', cell: NameCell },
  { id: 'type', header: 'Type', cell: TypeCell },
  { id: 'status', header: 'Status', cell: StatusCell },
];

export function ResourcesTable({ resources }: ResourcesTableProps) {
  return <InteractiveTable columns={columns} data={resources} getRowId={(r) => r.uid} pageSize={15} />;
}

function NameCell(props: CellProps<MigrationResourceDTO>) {
  const data = props.row.original;
  return (
    <Stack direction="row" gap={2} alignItems="center">
      <ResourceIcon resource={data} />

      <Stack direction="column" gap={0}>
        <span>{data.resource.name}</span>
        <Text color="secondary">{data.resource.type}</Text>
      </Stack>
    </Stack>
  );
}

function TypeCell(props: CellProps<MigrationResourceDTO>) {
  const { type } = props.row.original;

  if (type === 'datasource') {
    return t('migrate-to-cloud.resource-type.datasource', 'Data source');
  }

  if (type === 'dashboard') {
    return t('migrate-to-cloud.resource-type.dashboard', 'Dashboard');
  }

  return t('migrate-to-cloud.resource-type.unknown', 'Unknown');
}

function StatusCell(props: CellProps<MigrationResourceDTO>) {
  const { status, statusMessage } = props.row.original;

  if (status === 'not-migrated') {
    return <Text color="secondary">{t('migrate-to-cloud.resource-status.not-migrated', 'Not yet uploaded')}</Text>;
  } else if (status === 'migrating') {
    return <Text color="info">{t('migrate-to-cloud.resource-status.migrating', 'Uploading...')}</Text>;
  } else if (status === 'migrated') {
    return <Text color="success">{t('migrate-to-cloud.resource-status.migrated', 'Uploaded to cloud')}</Text>;
  } else if (status === 'failed') {
    return (
      <Stack alignItems="center">
        <Text color="error">{t('migrate-to-cloud.resource-status.failed', 'Error')}</Text>

        {statusMessage && (
          // TODO: trigger a proper modal, probably from the parent, on click
          <Button size="sm" variant="secondary" onClick={() => window.alert(statusMessage)}>
            {t('migrate-to-cloud.resource-status.error-details-button', 'Details')}
          </Button>
        )}
      </Stack>
    );
  }

  return <Text color="secondary">{t('migrate-to-cloud.resource-status.unknown', 'Unknown')}</Text>;
}

function ResourceIcon({ resource }: { resource: MigrationResourceDTO }) {
  const styles = useStyles2(getIconStyles);

  if (resource.type === 'dashboard') {
    return <Icon size="xl" name="dashboard" />;
  }

  if (resource.type === 'datasource' && resource.resource.icon) {
    return <img className={styles.icon} src={resource.resource.icon} alt="" />;
  } else if (resource.type === 'datasource') {
    return <Icon size="xl" name="database" />;
  }

  return undefined;
}

function getIconStyles() {
  return {
    icon: css({
      display: 'block',
      width: getSvgSize('xl'),
      height: getSvgSize('xl'),
    }),
  };
}
