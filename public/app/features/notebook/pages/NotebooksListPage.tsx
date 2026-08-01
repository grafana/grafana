import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { AppEvents, dateTimeFormatTimeAgo, type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { useFlagDashboardNotebooks } from '@grafana/runtime/internal';
import { type NotebookElement } from '@grafana/schema/apis/notebook/v2beta1';
import {
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  FilterInput,
  Icon,
  LinkButton,
  Spinner,
  Stack,
  TagList,
  useStyles2,
} from '@grafana/ui';
import { useDeleteNotebookMutation, useListNotebookQuery, type Notebook } from 'app/api/clients/dashboard/v2beta1';
import { appEvents } from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { PageNotFound } from 'app/core/components/PageNotFound/PageNotFound';
import { copyStringToClipboard } from 'app/core/utils/explore';

import { createNotebook, duplicateNotebook, notebookEditUrl, notebookViewUrl } from '../api/notebookAPI';
import { markNotebookAsNew } from '../model/newNotebookSignal';
import { newNotebookSpec } from '../model/notebookSpec';

export function NotebooksListPage() {
  const notebooksEnabled = useFlagDashboardNotebooks();
  const styles = useStyles2(getStyles);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Notebook | undefined>();
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useListNotebookQuery(notebooksEnabled ? {} : { limit: 0 });
  const [deleteNotebook] = useDeleteNotebookMutation();

  const notebooks = useMemo(() => {
    const items = [...(data?.items ?? [])];
    // ISO timestamps sort correctly with plain string comparison.
    items.sort((a, b) => (lastUpdated(b) > lastUpdated(a) ? 1 : -1));
    if (!search) {
      return items;
    }
    const needle = search.toLowerCase();
    return items.filter(
      (nb) =>
        nb.spec.title.toLowerCase().includes(needle) ||
        (nb.spec.description ?? '').toLowerCase().includes(needle) ||
        nb.spec.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
        contentMatches(nb, needle)
    );
  }, [data, search]);

  if (!notebooksEnabled) {
    return <PageNotFound />;
  }

  const onCreate = async () => {
    setCreating(true);
    try {
      const created = await createNotebook(
        newNotebookSpec(t('notebooks.list.new-notebook-title', 'Untitled notebook'))
      );
      markNotebookAsNew(created.metadata.name);
      locationService.push(notebookEditUrl(created.metadata.name));
    } finally {
      setCreating(false);
    }
  };

  const onCopyLink = (notebook: Notebook) => {
    copyStringToClipboard(new URL(notebookViewUrl(notebook.metadata.name ?? ''), window.location.origin).toString());
    appEvents.emit(AppEvents.alertSuccess, [t('notebooks.list.link-copied', 'Notebook link copied')]);
  };

  // Duplicating makes notebooks reusable as investigation templates. The copy opens
  // in the editor with its title focused, ready to rename.
  const onDuplicate = async (notebook: Notebook) => {
    const created = await duplicateNotebook(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client spec bridged to the schema spec at the API seam
      notebook.spec as Parameters<typeof duplicateNotebook>[0],
      t('notebooks.list.copy-title', '{{title}} (copy)', { title: notebook.spec.title })
    );
    locationService.push(notebookEditUrl(created.metadata.name));
  };

  const createButton = (
    <Button icon="plus" onClick={onCreate} disabled={creating} data-testid="notebooks-create">
      <Trans i18nKey="notebooks.list.new-notebook">New notebook</Trans>
    </Button>
  );

  return (
    <Page
      navId="notebooks"
      subTitle={t(
        'notebooks.list.subtitle',
        'Capture investigations combining narrative text with live visualizations from your dashboards and Explore.'
      )}
      actions={createButton}
    >
      <Page.Contents>
        <Stack direction="column" gap={2}>
          <FilterInput
            value={search}
            onChange={setSearch}
            placeholder={t('notebooks.list.search-placeholder', 'Search notebooks by name, description or tag')}
          />

          {isLoading && <Spinner />}

          {!isLoading && !error && notebooks.length === 0 && !search && (
            <EmptyState
              variant="call-to-action"
              message={t('notebooks.list.empty-title', 'You have not created any notebooks yet')}
              button={createButton}
            >
              <Trans i18nKey="notebooks.list.empty-body">
                Notebooks are living documents for investigations: mix text with live panels added from dashboards and
                Explore, and collaborate with your team in real time.
              </Trans>
            </EmptyState>
          )}

          {!isLoading && notebooks.length === 0 && search && (
            <EmptyState
              variant="not-found"
              message={t('notebooks.list.no-results', 'No notebooks match your search')}
            />
          )}

          <ul className={styles.list}>
            {notebooks.map((notebook) => {
              const name = notebook.metadata.name ?? '';
              const cells = countCells(notebook);
              const panels = countPanels(notebook);
              return (
                <li key={name}>
                  <Card noMargin href={notebookViewUrl(name)} data-testid={`notebook-card-${name}`}>
                    <Card.Figure>
                      <Icon name="book-open" size="xl" />
                    </Card.Figure>
                    <Card.Heading>{notebook.spec.title}</Card.Heading>
                    {notebook.spec.description && <Card.Description>{notebook.spec.description}</Card.Description>}
                    <Card.Meta>
                      {[
                        t('notebooks.list.updated', 'Updated {{when}}', {
                          when: dateTimeFormatTimeAgo(lastUpdated(notebook)),
                        }),
                        // Live panels are the load-bearing content — lead with them; text-only
                        // notebooks fall back to the block count.
                        panels > 0
                          ? t('notebooks.list.panel-count', '', {
                              count: panels,
                              defaultValue_one: '{{count}} panel',
                              defaultValue_other: '{{count}} panels',
                            })
                          : t('notebooks.list.cell-count', '', {
                              count: cells,
                              defaultValue_one: '{{count}} block',
                              defaultValue_other: '{{count}} blocks',
                            }),
                      ]}
                    </Card.Meta>
                    {notebook.spec.tags.length > 0 && (
                      <Card.Tags>
                        <TagList tags={notebook.spec.tags} />
                      </Card.Tags>
                    )}
                    <Card.SecondaryActions>
                      <LinkButton
                        key="edit"
                        variant="secondary"
                        fill="outline"
                        size="sm"
                        icon="pen"
                        href={notebookEditUrl(name)}
                      >
                        <Trans i18nKey="notebooks.list.edit">Edit</Trans>
                      </LinkButton>
                      <Button
                        key="copy-link"
                        variant="secondary"
                        fill="outline"
                        size="sm"
                        icon="link"
                        onClick={(e) => {
                          // Never let the click reach the card's navigation link.
                          e.preventDefault();
                          e.stopPropagation();
                          onCopyLink(notebook);
                        }}
                        tooltip={t('notebooks.list.copy-link', 'Copy link')}
                        aria-label={t('notebooks.list.copy-link-label', 'Copy link to notebook {{title}}', {
                          title: notebook.spec.title,
                        })}
                      />
                      <Button
                        key="duplicate"
                        variant="secondary"
                        fill="outline"
                        size="sm"
                        icon="copy"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDuplicate(notebook);
                        }}
                        tooltip={t('notebooks.list.duplicate', 'Duplicate')}
                        aria-label={t('notebooks.list.duplicate-label', 'Duplicate notebook {{title}}', {
                          title: notebook.spec.title,
                        })}
                      />
                      <Button
                        key="delete"
                        variant="destructive"
                        fill="outline"
                        size="sm"
                        icon="trash-alt"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTarget(notebook);
                        }}
                        tooltip={t('notebooks.list.delete', 'Delete')}
                        aria-label={t('notebooks.list.delete-label', 'Delete notebook {{title}}', {
                          title: notebook.spec.title,
                        })}
                      />
                    </Card.SecondaryActions>
                  </Card>
                </li>
              );
            })}
          </ul>
        </Stack>

        <ConfirmModal
          isOpen={!!deleteTarget}
          title={t('notebooks.list.delete-title', 'Delete notebook')}
          body={t('notebooks.list.delete-body', 'Are you sure you want to delete "{{title}}"?', {
            title: deleteTarget?.spec.title ?? '',
          })}
          confirmText={t('notebooks.list.delete-confirm', 'Delete')}
          onConfirm={async () => {
            if (deleteTarget?.metadata.name) {
              await deleteNotebook({ name: deleteTarget.metadata.name });
            }
            setDeleteTarget(undefined);
          }}
          onDismiss={() => setDeleteTarget(undefined)}
        />
      </Page.Contents>
    </Page>
  );
}

function lastUpdated(notebook: Notebook): string {
  return notebook.metadata.annotations?.['grafana.app/updatedTimestamp'] ?? notebook.metadata.creationTimestamp ?? '';
}

function countCells(notebook: Notebook): number {
  return notebook.spec.layout.spec.cells.length;
}

function countPanels(notebook: Notebook): number {
  return notebookElements(notebook).filter((element) => element.kind === 'Panel' || element.kind === 'LibraryPanel')
    .length;
}

function notebookElements(notebook: Notebook): NotebookElement[] {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- generated client element union bridged to the schema union at the read seam
  return Object.values(notebook.spec.elements) as unknown as NotebookElement[];
}

// The list endpoint returns full specs, so block contents are searchable client-side
// at POC scale (a proper search index is the GA path).
function contentMatches(notebook: Notebook, needle: string): boolean {
  return notebookElements(notebook).some((element) => {
    if (element.kind === 'Panel' || element.kind === 'LibraryPanel') {
      return element.spec.title.toLowerCase().includes(needle);
    }
    if (element.kind === 'Cell') {
      const content = element.spec.content;
      const text = content.kind === 'Markdown' ? content.spec.text : content.kind === 'Code' ? content.spec.code : '';
      return text.toLowerCase().includes(needle);
    }
    return false;
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    display: 'grid',
    gap: theme.spacing(1),
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
});

export default NotebooksListPage;
