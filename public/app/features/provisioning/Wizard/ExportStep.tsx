import { css } from '@emotion/css';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, FieldSet, Stack, Text, useStyles2 } from '@grafana/ui';

import { ExportJobStatus } from '../ExportToRepository';
import { useCreateRepositoryExportMutation } from '../api';

import { WizardFormData } from './types';

export function ExportStep() {
  const styles = useStyles2(getStyles);
  const [exportRepo, exportQuery] = useCreateRepositoryExportMutation();
  const { watch } = useFormContext<WizardFormData>();
  const [repositoryName, branch] = watch(['repositoryName', 'repository.branch']);
  const exportName = exportQuery.data?.metadata?.name;

  const handleExport = () => {
    if (!repositoryName) {
      return;
    }

    exportRepo({
      name: repositoryName,
      body: {
        branch,
        history: true,
        identifier: true,
      },
    });
  };

  if (exportName) {
    return <ExportJobStatus name={exportName} />;
  }

  return (
    <FieldSet label="3. Export dashboards">
      <Stack direction={'column'} gap={2}>
        <div className={styles.description}>
          <Text color="secondary">
            Export all dashboards from this instance to your repository. After this one-time export, all future updates
            will be automatically saved to the repository.
          </Text>
        </div>

        <div className={styles.exportInfo}>
          <div>
            <Text>All dashboards and folders in instance</Text>
            <Text color="secondary">28</Text>
          </div>
        </div>
        <Stack alignItems={'flex-start'}>
          <Button
            onClick={handleExport}
            disabled={exportQuery.isLoading || !repositoryName}
            icon={exportQuery.isLoading ? 'spinner' : undefined}
          >
            Export dashboards
          </Button>
        </Stack>
      </Stack>
    </FieldSet>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  description: css({
    marginBottom: theme.spacing(3),
  }),
  exportInfo: css({
    marginTop: theme.spacing(3),
    padding: theme.spacing(2),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
});
