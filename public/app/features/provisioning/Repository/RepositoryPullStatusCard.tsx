import { css } from '@emotion/css';

import { t, Trans } from '@grafana/i18n';
import { Badge, Card, Grid, Text, TextLink, useStyles2 } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';

import { MessageList } from '../Shared/MessageList';
import { getRepoCommitUrl } from '../utils/git';
import { getStatusColor, getStatusIcon } from '../utils/repositoryStatus';
import { formatTimestamp } from '../utils/time';

import { SyncRepository } from './SyncRepository';

export function RepositoryPullStatusCard({ repo }: { repo: Repository }) {
  const styles = useStyles2(getStyles);
  const status = repo.status;
  const statusColor = getStatusColor(status?.sync.state);
  const statusIcon = getStatusIcon(status?.sync.state);

  const { url: lastCommitUrl, hasUrl } = getRepoCommitUrl(repo.spec, status?.sync.lastRef);

  return (
    <Card noMargin>
      <Card.Heading>
        <Trans i18nKey="provisioning.repository-overview.pull-status">Pull status</Trans>
      </Card.Heading>
      <Card.Description>
        <Grid columns={3} gap={1} alignItems="baseline">
          {/* Status */}
          <Text color="secondary">
            <Trans i18nKey="provisioning.repository-overview.status">Status:</Trans>
          </Text>
          <div className={styles.spanTwo}>
            <Badge icon={statusIcon} color={statusColor} text={status?.sync.state ?? 'N/A'} />
          </div>

          {/* Job ID */}
          <Text color="secondary">
            <Trans i18nKey="provisioning.repository-overview.job-id">Job ID:</Trans>
          </Text>
          <div className={styles.spanTwo}>
            <Text variant="body">{status?.sync.job ?? 'N/A'}</Text>
          </div>

          {/* Last Ref */}
          <Text color="secondary">
            <Trans i18nKey="provisioning.repository-overview.last-ref">Last Ref:</Trans>
          </Text>
          <div className={styles.spanTwo}>
            {hasUrl && lastCommitUrl ? (
              <TextLink href={lastCommitUrl} external>
                <Text variant="body">
                  {status?.sync.lastRef
                    ? status.sync.lastRef.substring(0, 7)
                    : t('provisioning.repository-overview.not-available', 'N/A')}
                </Text>
              </TextLink>
            ) : (
              <Text variant="body">
                {status?.sync.lastRef
                  ? status.sync.lastRef.substring(0, 7)
                  : t('provisioning.repository-overview.not-available', 'N/A')}
              </Text>
            )}
          </div>

          <Text color="secondary">
            <Trans i18nKey="provisioning.repository-overview.finished">Last successful pull:</Trans>
          </Text>
          <div className={styles.spanTwo}>
            <Text variant="body">{formatTimestamp(status?.sync.finished)}</Text>
          </div>

          {!!status?.sync?.message?.length && (
            <>
              <Text color="secondary">
                <Trans i18nKey="provisioning.repository-overview.messages">Messages:</Trans>
              </Text>
              <div className={styles.spanTwo}>
                <MessageList messages={status.sync.message} variant="body" />
              </div>
            </>
          )}
        </Grid>
      </Card.Description>
      <Card.Actions>
        <SyncRepository repository={repo} />
      </Card.Actions>
    </Card>
  );
}

const getStyles = () => {
  return {
    spanTwo: css({
      gridColumn: 'span 2',
    }),
  };
};
