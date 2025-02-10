import { useEffect } from 'react';

import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Button } from '@grafana/ui';

import { Loader } from '../plugins/admin/components/Loader';

import { Repository, useCreateRepositoryTestMutation, useListRepositoryQuery } from './api';

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
    testRepo({ name });
  };

  if (testQuery.isLoading) {
    return <Loader />;
  }

  return (
    <>
      <Button
        icon="check-circle"
        variant={'secondary'}
        disabled={testQuery.isLoading || !name}
        onClick={() => onClick()}
      >
        Check
      </Button>
    </>
  );
}
