import { css } from '@emotion/css';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, FieldSet, Stack, Text, useStyles2 } from '@grafana/ui';

import { useCreateOrUpdateRepository } from '../hooks';
import { dataToSpec } from '../utils/data';

import { WizardFormData } from './types';

export function ProvisioningStep() {
  const styles = useStyles2(getStyles);
  const { getValues } = useFormContext<WizardFormData>();
  const repositoryName = getValues('repositoryName');
  const [submitData, request] = useCreateOrUpdateRepository(repositoryName);

  const handleProvision = async () => {
    const formData = getValues();
    await submitData(
      dataToSpec({
        ...formData.repository,
        sync: {
          ...formData.repository.sync,
          enabled: true,
        },
      })
    );
  };

  return (
    <FieldSet label="4. Start provisioning">
      <Stack direction={'column'} gap={2}>
        <Stack direction={'column'} gap={2}>
          <Text element="h5">What happens in this step?</Text>
          <ul className={styles.list}>
            <li>Begin to read from new storage</li>
            <li>Import from repo to new storage</li>
            <li>Old storage still safe</li>
            <li>URL will stay the same, external links to the dashboards will still work</li>
          </ul>
        </Stack>

        <Stack alignItems={'flex-start'}>
          <Button
            onClick={handleProvision}
            disabled={request.isLoading}
            icon={request.isLoading ? 'spinner' : undefined}
          >
            {request.isLoading ? 'Starting...' : 'Start provisioning'}
          </Button>
        </Stack>
      </Stack>
    </FieldSet>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    margin: theme.spacing(1, 0),
    paddingLeft: theme.spacing(4),
    '& li': {
      marginBottom: theme.spacing(1),
      '&:last-child': {
        marginBottom: 0,
      },
    },
  }),
});
