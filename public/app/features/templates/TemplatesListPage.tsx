import { Spinner, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

export function TemplatesListPage() {
  return (
    <Page
      navId="dashboard-templates"
      pageNav={{
        text: 'Dashboard templates',
        subTitle: 'Start with a Grafana dashboard',
      }}
    >
      <Page.Contents>
        <Stack direction={'column'} justifyContent="center">
          <Stack justifyContent="center">
            <Spinner size="xxl" />
          </Stack>
        </Stack>
      </Page.Contents>
    </Page>
  );
}
