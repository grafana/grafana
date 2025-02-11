import { Spinner, Card, Alert, Tag, Text } from '@grafana/ui';
import { formatTimestamp } from './utils/time';
import { Repository, useListJobQuery } from './api';

interface Props {
  repo: Repository;
}

export function RecentJobs({ repo }: Props) {
  const name = repo.metadata?.name;
  const query = useListJobQuery({ labelSelector: `repository=${name}` });
  const items = query?.data?.items ?? [];

  if (query.isLoading) {
    return <Spinner />;
  }
  if (query.isError) {
    return (
      <Alert title="error loading jobs">
        <pre>{JSON.stringify(query.error)}</pre>
      </Alert>
    );
  }
  if (!items?.length) {
    return (
      <div>
        No recent events...
        <br />
        Note: history is not maintained after system restart
      </div>
    );
  }

  return (
    <div>
      {items.slice(0, 10).map((item) => {
        return (
          <Card key={item.metadata?.resourceVersion}>
            <Card.Heading>{item.spec?.action}</Card.Heading>
            <Card.Tags>
              <Tag
                name={item.status?.state || ''}
                color={
                  item.status?.state === 'success'
                    ? 'success'
                    : item.status?.state === 'working'
                      ? 'warning'
                      : item.status?.state === 'pending'
                        ? 'warning'
                        : item.status?.state === 'error'
                          ? 'error'
                          : 'secondary'
                }
                icon={item.status?.state === 'working' ? 'spinner' : undefined}
              />
            </Card.Tags>
            <Card.Description>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px' }}>
                <Text color="secondary">Started:</Text>
                <Text>{formatTimestamp(item.status?.started)}</Text>
                <Text color="secondary">Ended:</Text>
                <Text>{formatTimestamp(item.status?.finished)}</Text>
                {item.status?.message && (
                  <>
                    <Text color="secondary">Message:</Text>
                    <Text>{item.status.message}</Text>
                  </>
                )}
              </div>
            </Card.Description>
          </Card>
        );
      })}
    </div>
  );
}
