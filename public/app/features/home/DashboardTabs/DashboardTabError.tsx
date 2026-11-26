import { Trans } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

interface Props {
  title: string;
  retry: () => void;
}

/** The warning of a tab whose rows, or some of them, could not be loaded, with a retry. */
export function DashboardTabErrorAlert({ title, retry }: Props) {
  return (
    // Extra div as Alert will flex-grow by default, and the tab lays its content out in a column
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
  );
}

/** Centered error state shared by the dashboard tabs. */
export function DashboardTabError(props: Props) {
  return (
    <Stack grow={1} direction="column" alignItems="center" justifyContent="center">
      <DashboardTabErrorAlert {...props} />
    </Stack>
  );
}
