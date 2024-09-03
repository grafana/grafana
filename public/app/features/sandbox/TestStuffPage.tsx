import { useLayoutEffect, useMemo, useState } from 'react';

import { NavModelItem } from '@grafana/data';
import { getPluginExtensions, isPluginExtensionLink } from '@grafana/runtime';
import { Button, LinkButton, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useAppNotification } from 'app/core/copy/appNotification';

import { log, LogItem } from '../plugins/extensions/log';

import { Logs } from './Logs';

export const TestStuffPage = () => {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const observable = useMemo(() => log.asObservable(), []);

  useLayoutEffect(() => {
    const subscription = observable.subscribe((item) => {
      setLogs((logs) => [item, ...logs]);
    });
    return () => subscription.unsubscribe();
  }, [observable]);

  const node: NavModelItem = {
    id: 'test-page',
    text: 'Test page',
    icon: 'dashboard',
    subTitle: 'FOR TESTING!',
    url: 'sandbox/test',
  };

  const notifyApp = useAppNotification();

  return (
    <Page navModel={{ node: node, main: node }}>
      <Stack>
        {logs.length}
        <LinkToBasicApp extensionPointId="grafana/sandbox/testing" />
        <Button onClick={() => notifyApp.success('Success toast', 'some more text goes here')} variant="primary">
          Success
        </Button>
        <Button
          onClick={() => notifyApp.warning('Warning toast', 'some more text goes here', 'bogus-trace-99999')}
          variant="secondary"
        >
          Warning
        </Button>
        <Button
          onClick={() => notifyApp.error('Error toast', 'some more text goes here', 'bogus-trace-fdsfdfsfds')}
          variant="destructive"
        >
          Error
        </Button>
        <Logs></Logs>
      </Stack>
    </Page>
  );
};

function LinkToBasicApp({ extensionPointId }: { extensionPointId: string }) {
  const { extensions } = getPluginExtensions({ extensionPointId });

  if (extensions.length === 0) {
    return null;
  }

  return (
    <div>
      {extensions.map((extension, i) => {
        if (!isPluginExtensionLink(extension)) {
          return null;
        }
        return (
          <LinkButton href={extension.path} title={extension.description} key={extension.id}>
            {extension.title}
          </LinkButton>
        );
      })}
    </div>
  );
}

export default TestStuffPage;
