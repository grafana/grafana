import { Trans } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

interface Props {
  title: string;
  retry: () => void;
}

/** Centered error state shared by the dashboard tabs. */
export function DashboardTabError({ title, retry }: Props) {
  return (
    <Stack grow={1} direction="column" alignItems="center" justifyContent="center">
      {/* Extra div as Alert will flex-grow by default, but we want it centered */}
      <div>
        <Alert
          severity="warning"
          title={title}
          action={
            <Button onClick={retry} variant="secondary" size="sm">
              <Trans i18nKey="home.dashboard-tabs.retry">Retry</Trans>
            </Button>
          }
        />
      </div>
    </Stack>
  );
}
