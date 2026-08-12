import { PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Box } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { type NotebookLoadError } from './NotebookPageStateManager';

interface NotebookPageErrorProps {
  error: NotebookLoadError;
}

export function NotebookPageError({ error }: NotebookPageErrorProps) {
  // Shared by the breadcrumb and the body so the two cannot describe the failure differently.
  const isNotFound = error.status === 404;

  return (
    <Page
      navId="notebooks"
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
