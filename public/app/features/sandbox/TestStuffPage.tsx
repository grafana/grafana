import { NavModelItem } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';
import { Button, LinkButton, Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useAppNotification } from 'app/core/copy/appNotification';
import { Trans } from 'app/core/internationalization';

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
      <Text variant="h5">
        <Trans i18nKey="sandbox.test-stuff-page.application-notifications-toasts-testing">
          Application notifications (toasts) testing
        </Trans>
      </Text>
      <Stack>
        <Button onClick={() => notifyApp.success('Success toast', 'some more text goes here')} variant="primary">
          <Trans i18nKey="sandbox.test-stuff-page.success">Success</Trans>
        </Button>
        <Button
          onClick={() => notifyApp.warning('Warning toast', 'some more text goes here', 'bogus-trace-99999')}
          variant="secondary"
        >
          <Trans i18nKey="sandbox.test-stuff-page.warning">Warning</Trans>
        </Button>
        <Button
          onClick={() => notifyApp.error('Error toast', 'some more text goes here', 'bogus-trace-fdsfdfsfds')}
          variant="destructive"
        >
          <Trans i18nKey="sandbox.test-stuff-page.error">Error</Trans>
        </Button>
      </Stack>
    </Page>
  );
};

function LinkToBasicApp({ extensionPointId }: { extensionPointId: string }) {
  const { links } = usePluginLinks({ extensionPointId });

  if (links.length === 0) {
    return null;
  }

  return (
    <div>
      {links.map((link, i) => {
        return (
          <LinkButton href={link.path} title={link.description} key={link.id}>
            {link.title}
          </LinkButton>
        );
      })}
    </div>
  );
}

export default TestStuffPage;
