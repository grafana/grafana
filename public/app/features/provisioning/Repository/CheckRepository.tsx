import { Button, Spinner } from '@grafana/ui';
import { Repository, useCreateRepositoryTestMutation } from 'app/api/clients/provisioning';
import { Trans } from 'app/core/internationalization';

interface Props {
  repository: Repository;
}

export function CheckRepository({ repository }: Props) {
  const [testRepo, testQuery] = useCreateRepositoryTestMutation();
  const name = repository.metadata?.name;

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
