import { useEffect } from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button, Spinner } from '@grafana/ui';
import { Repository, useCreateRepositoryTestMutation } from 'app/api/clients/provisioning';
import { Trans } from 'app/core/internationalization';

interface Props {
  repository: Repository;
}

export function CheckRepository({ repository }: Props) {
  const [testRepo, testQuery] = useCreateRepositoryTestMutation();
  const name = repository.metadata?.name;

  useEffect(() => {
    const appEvents = getAppEvents();
    if (testQuery.isSuccess) {
      appEvents.publish({
        type: AppEvents.alertSuccess.name,
        payload: ['Test started'],
      });
    } else if (testQuery.isError) {
      appEvents.publish({
        type: AppEvents.alertError.name,
        payload: ['Error testing repository', testQuery.error],
      });
    }
  }, [testQuery.error, testQuery.isError, testQuery.isSuccess]);

  const onClick = () => {
    if (!name) {
      return;
    }
    testRepo({ name, body: {} });
  };

  if (testQuery.isLoading) {
    return <Spinner />;
  }

  return (
    <>
      <Button icon="check-circle" variant={'secondary'} disabled={testQuery.isLoading || !name} onClick={onClick}>
        <Trans i18nKey="provisioning.check-repository.check">Check</Trans>
      </Button>
    </>
  );
}
