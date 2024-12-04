import { useLocation } from 'react-router';
import { useParams } from 'react-router-dom-v5-compat';
import AutoSizer from 'react-virtualized-auto-sizer';

import { urlUtil } from '@grafana/data';
import {
  Alert,
  CodeEditor,
  EmptyState,
  LinkButton,
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

import { useGetRepositoryFilesQuery, useGetRepositoryStatusQuery } from './api';
import { ResourceWrapper } from './api/types';
import { PROVISIONING_URL } from './constants';

export default function FileStatusPage() {
  const params = useParams();
  const [queryParams] = useQueryParams();
  const ref = (queryParams['ref'] as string) ?? undefined;
  const tab = (queryParams['tab'] as TabSelection) ?? TabSelection.Lint;
  const name = params['name'] ?? '';
  const path = params['*'] ?? '';
  const query = useGetRepositoryStatusQuery({ name });
  const file = useGetRepositoryFilesQuery({ name, path, ref });

  //@ts-expect-error TODO add error types
  const notFound = query.isError && query.error?.status === 404;
  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: `File: ${path} ${ref ? `(@${ref})` : ''}`,
        subTitle: query.data?.spec.title ?? 'Repository',
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
  Lint = 'lint',
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
  delete queryParams['tab'];
  let tabHref = location.pathname + '?' + urlUtil.toUrlParams(queryParams);
  tabHref = urlUtil.appendQueryToUrl(tabHref, 'tab=');
  let showJSON = '';
  switch (tab) {
    case TabSelection.Existing:
      showJSON = JSON.stringify(wrap.resource.existing, null, '  ');
      break;
    case TabSelection.DryRun:
      showJSON = JSON.stringify(wrap.resource.dryRun, null, '  ');
      break;
    case TabSelection.File:
      showJSON = JSON.stringify(wrap.resource.file, null, '  ');
      break;
  }

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
        <Tab
          href={`${tabHref}lint`}
          key={TabSelection.Lint}
          label={'Lint issues'}
          active={tab === TabSelection.Lint}
          counter={wrap.lint?.length}
        />
        <Tab href={`${tabHref}file`} key={TabSelection.File} label={'File'} active={tab === TabSelection.File} />
        <Tab
          href={`${tabHref}existing`}
          key={TabSelection.Existing}
          label={'Existing'}
          active={tab === TabSelection.Existing}
        />
        <Tab
          href={`${tabHref}dryRun`}
          key={TabSelection.DryRun}
          label={'Dry Run'}
          active={tab === TabSelection.DryRun}
        />
      </TabsBar>
      <TabContent>
        {tab === TabSelection.Lint && (
          <div>
            {wrap.lint ? (
              wrap.lint.map((r) => (
                <Alert title={r.rule} severity={r.severity}>
                  {r.message}
                </Alert>
              ))
            ) : (
              <div>
                <h3>No lint issues</h3>
              </div>
            )}
          </div>
        )}

        {tab !== TabSelection.Lint && (
          <div style={{ height: 800 }}>
            <AutoSizer disableWidth>
              {({ height }) => (
                <CodeEditor
                  width="100%"
                  height={height}
                  language={'json'}
                  showLineNumbers={true}
                  showMiniMap={true}
                  value={showJSON}
                  readOnly={true}
                />
              )}
            </AutoSizer>
          </div>
        )}
      </TabContent>
    </div>
  );
}
