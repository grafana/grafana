import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useParams } from 'react-router-dom-v5-compat';
import AutoSizer from 'react-virtualized-auto-sizer';

import { urlUtil } from '@grafana/data';
import {
  Alert,
  CodeEditor,
  EmptyState,
  LinkButton,
  Button,
  Spinner,
  Stack,
  Tab,
  TabContent,
  TabsBar,
  Text,
  TextLink,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import {
  useGetRepositoryFilesWithPathQuery,
  useGetRepositoryStatusQuery,
  ResourceWrapper,
  useReplaceRepositoryFilesWithPathMutation,
} from './api';
import { PROVISIONING_URL } from './constants';

export default function FileStatusPage() {
  const params = useParams();
  const [queryParams] = useQueryParams();
  const ref = (queryParams['ref'] as string) ?? undefined;
  const tab = (queryParams['tab'] as TabSelection) ?? TabSelection.File;
  const name = params['name'] ?? '';
  const path = params['*'] ?? '';
  const query = useGetRepositoryStatusQuery({ name });
  const file = useGetRepositoryFilesWithPathQuery({ name, path, ref });

  //@ts-expect-error TODO add error types
  const notFound = query.isError && query.error?.status === 404;
  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: `File: ${path} ${ref ? `(@${ref})` : ''}`,
        subTitle: query.data?.spec?.title ?? 'Repository',
      }}
    >
      <Page.Contents isLoading={false}>
        {notFound ? (
          <EmptyState message={`Repository not found`} variant="not-found">
            <Text element={'p'}>Make sure the repository config exists in the configuration file.</Text>
            <TextLink href={PROVISIONING_URL}>Back to repositories</TextLink>
          </EmptyState>
        ) : (
          <div>{file.data ? <ResourceView wrap={file.data} repo={name} repoRef={ref} tab={tab} /> : <Spinner />}</div>
        )}
      </Page.Contents>
    </Page>
  );
}

enum TabSelection {
  File = 'file',
  Existing = 'existing',
  DryRun = 'dryRun',
}

interface Props {
  wrap: ResourceWrapper;
  repo: string;
  repoRef?: string;
  tab: TabSelection;
}

function ResourceView({ wrap, repo, repoRef, tab }: Props) {
  const isDashboard = wrap.resource?.type?.kind === 'Dashboard';
  const existingName = wrap.resource?.existing?.metadata?.name;
  const location = useLocation();
  const [queryParams] = useQueryParams();
  const [replaceFile, replaceFileStatus] = useReplaceRepositoryFilesWithPathMutation();

  const [jsonView, setJsonView] = useState('');

  useEffect(() => {
    switch (tab) {
      case TabSelection.Existing:
        setJsonView(JSON.stringify(wrap.resource.existing, null, 2));
        return;
      case TabSelection.DryRun:
        setJsonView(JSON.stringify(wrap.resource.dryRun, null, 2));
        return;
      case TabSelection.File:
        setJsonView(JSON.stringify(wrap.resource.file, null, 2));
        return;
    }
  }, [wrap, tab, setJsonView]);

  const tabInfo = [
    { value: TabSelection.File, label: 'File (from repository)' },
    { value: TabSelection.Existing, label: 'Existing (from grafana)' },
    { value: TabSelection.DryRun, label: 'Dry Run (result after apply)' },
  ];

  return (
    <div>
      <Stack>
        {isDashboard && (
          <LinkButton target={'_blank'} href={`${PROVISIONING_URL}/${repo}/dashboard/preview/${wrap.path}`}>
            Dashboard Preview
          </LinkButton>
        )}
        {isDashboard && existingName && (
          <LinkButton target={'_blank'} href={`d/${wrap.resource.existing?.metadata.name}`} variant="secondary">
            Existing dashboard
          </LinkButton>
        )}
        <LinkButton href={`${PROVISIONING_URL}/${repo}`} variant="secondary">
          Repository
        </LinkButton>
        {repoRef && (
          <LinkButton href={`${PROVISIONING_URL}/${repo}/file/${wrap.path}`} variant="secondary">
            Base
          </LinkButton>
        )}
        <LinkButton href={`${PROVISIONING_URL}/${repo}/history/${wrap.path}`} variant="secondary">
          History
        </LinkButton>
      </Stack>

      <br />
      <br />

      <TabsBar>
        {tabInfo.map((t) => (
          <Tab
            href={urlUtil.renderUrl(location.pathname, { ...queryParams, tab: t.value })}
            key={t.value}
            label={t.label}
            active={tab === t.value}
          />
        ))}
      </TabsBar>
      <TabContent>
        <div>
          <div style={{ height: 800 }}>
            <AutoSizer disableWidth>
              {({ height }) => (
                <CodeEditor
                  width="100%"
                  height={height}
                  language={'json'}
                  showLineNumbers={true}
                  showMiniMap={true}
                  value={jsonView}
                  onBlur={setJsonView}
                  onSave={setJsonView}
                />
              )}
            </AutoSizer>
          </div>
          <Stack direction={'row'}>
            <Button
              disabled={replaceFileStatus.isLoading}
              onClick={() => {
                replaceFile({
                  name: repo,
                  path: wrap.path!,
                  body: JSON.parse(jsonView),
                  message: 'updated from repo test UI',
                });
              }}
            >
              {replaceFileStatus.isLoading ? 'Saving' : 'Save'}
            </Button>
          </Stack>
          {replaceFileStatus.isError && (
            <Alert title="Error saving file">
              <pre>{JSON.stringify(replaceFileStatus.error)}</pre>
            </Alert>
          )}
        </div>
      </TabContent>
    </div>
  );
}
