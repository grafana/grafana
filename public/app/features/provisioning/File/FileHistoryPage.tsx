import { skipToken } from '@reduxjs/toolkit/query';
import { useParams } from 'react-router-dom-v5-compat';

import { Trans, t } from '@grafana/i18n';
import { Card, EmptyState, Spinner, Stack, Text, TextLink, UserIcon } from '@grafana/ui';
import {
  useGetRepositoryHistoryWithPathQuery,
  useGetRepositoryStatusQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';
import { useUrlParams } from 'app/core/navigation/hooks';
import { isNotFoundError } from 'app/features/alerting/unified/api/util';

import { PROVISIONING_URL } from '../constants';
import { type HistoryListResponse } from '../types';
import { getRemoteConfig } from '../utils/git';
import { formatTimestamp } from '../utils/time';

import { isFileHistorySupported } from './utils';

export default function FileHistoryPage() {
  const params = useParams();
  const name = params['name'] ?? '';
  const path = params['*'] ?? '';
  const [urlParams] = useUrlParams();
  const repoType = urlParams.get('repo_type');
  const historyNotSupported = !isFileHistorySupported(repoType);
  const query = useGetRepositoryStatusQuery({ name });
  const repoUrl = getRemoteConfig(query.data?.spec)?.url;
  const history = useGetRepositoryHistoryWithPathQuery(historyNotSupported ? skipToken : { name, path });
  const notFound = (query.isError && isNotFoundError(query.error)) || historyNotSupported;

  const notFoundErrorMsg = historyNotSupported
    ? t('provisioning.file-history-page.history-not-supported', 'File history is not supported for this repository')
    : t('provisioning.file-history-page.repository-not-found', 'Repository not found');

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: `History: ${path}`,
        subTitle: query.data?.spec?.title ?? 'Repository',
      }}
    >
      <Page.Contents isLoading={false}>
        {notFound ? (
          <EmptyState message={notFoundErrorMsg} variant="not-found">
            <Text element={'p'}>
              {/* only show detail message if repoType is not git */}
              {repoType !== 'git' && (
                <Trans i18nKey="provisioning.file-history-page.repository-config-exists-configuration">
                  Make sure the repository config exists in the configuration file.
                </Trans>
              )}
            </Text>
            <TextLink href={PROVISIONING_URL}>
              <Trans i18nKey="provisioning.file-history-page.back-to-repositories">Back to repositories</Trans>
            </TextLink>
          </EmptyState>
        ) : (
          <div>
            {history.data ? (
              <HistoryView
                //@ts-expect-error OpenAPI generated response type is `string`; actual payload is HistoryList - causing type discrepancy error
                history={history.data}
                path={path}
                repo={name}
                repoType={repoType ?? undefined}
                repoUrl={repoUrl}
              />
            ) : (
              <Spinner />
            )}
          </div>
        )}
      </Page.Contents>
    </Page>
  );
}

interface Props {
  history: HistoryListResponse;
  path: string;
  repo: string;
  repoType?: string;
  repoUrl?: string;
}

function HistoryView({ history, path, repo, repoType, repoUrl }: Props) {
  if (!history.items) {
    return <Trans i18nKey="provisioning.history-view.not-found">Not found</Trans>;
  }

  return (
    <Stack direction={'column'}>
      {history.items.map((item) => (
        <Card
          noMargin
          href={`${PROVISIONING_URL}/${encodeURIComponent(repo)}/file/${path}?${new URLSearchParams({ ref: item.ref }).toString()}`}
          key={item.ref}
        >
          <Card.Heading>{item.message}</Card.Heading>
          <Card.Meta>
            <span>{formatTimestamp(item.createdAt)}</span>
          </Card.Meta>
          <Card.Description>
            <Stack>
              {item.authors.map((a) => {
                const profileUrl = getAuthorProfileUrl(repoType, a.username, repoUrl);
                return (
                  <span key={a.username} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {a.avatarURL && (
                      <UserIcon
                        userView={{
                          user: { name: a.name, avatarUrl: a.avatarURL },
                          lastActiveAt: new Date().toISOString(),
                        }}
                        showTooltip={false}
                      />
                    )}
                    {profileUrl ? (
                      <TextLink href={profileUrl} external>
                        {a.name}
                      </TextLink>
                    ) : (
                      <Text>{a.name}</Text>
                    )}
                  </span>
                );
              })}
            </Stack>
          </Card.Description>
        </Card>
      ))}
    </Stack>
  );
}

export function getAuthorProfileUrl(
  repoType: string | undefined,
  username: string,
  repoUrl?: string
): string | undefined {
  if (!repoUrl || !isFileHistorySupported(repoType)) {
    return undefined;
  }
  try {
    return `${new URL(repoUrl).origin}/${encodeURIComponent(username)}`;
  } catch {
    return undefined;
  }
}
