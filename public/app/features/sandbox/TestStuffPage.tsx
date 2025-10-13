import { NavModelItem } from '@grafana/data';
import { getPluginExtensions, isPluginExtensionLink } from '@grafana/runtime';
import { Button, LinkButton, Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useAppNotification } from 'app/core/copy/appNotification';

export const TestStuffPage = () => {
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
      <LinkToBasicApp extensionPointId="grafana/sandbox/testing" />
      <Text variant="h5">Application notifications (toasts) testing</Text>
      <Stack>
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
