import { PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { type NotebookLoadError } from './NotebookPageStateManager';

interface NotebookPageErrorProps {
  error: NotebookLoadError;
}

/**
 * Renders a notebook load failure. Mirrors DashboardPageError, but with notebook copy — a missing
 * notebook must not tell the user a dashboard was not found.
 *
 * The error arrives already normalized by NotebookPageStateManager, so status and message are read
 * directly rather than re-derived from an unknown value.
 */
export function NotebookPageError({ error }: NotebookPageErrorProps) {
  // Shared by the breadcrumb and the body so the two cannot describe the failure differently.
  const isNotFound = error.status === 404;

  return (
    <Page
      navId="dashboards/browse"
      layout={PageLayoutType.Canvas}
      pageNav={{
        text: isNotFound
          ? t('notebook.errors.not-found-title', 'Not found')
          : t('notebook.errors.failed-to-load', 'Failed to load notebook'),
      }}
    >
      <Box paddingY={4} display="flex" direction="column" alignItems="center">
        {isNotFound ? (
          <EntityNotFound entity="Notebook" />
        ) : (
          <Alert
            title={t('notebook.errors.failed-to-load', 'Failed to load notebook')}
            severity="error"
            data-testid="notebook-page-error"
          >
            {error.message}
          </Alert>
        )}
      </Box>
    </Page>
  );
}
