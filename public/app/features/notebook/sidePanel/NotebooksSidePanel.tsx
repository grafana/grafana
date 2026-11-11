import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { dateTime, type GrafanaTheme2, store } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Checkbox, FilterInput, IconButton, Input, Stack, Text, useStyles2 } from '@grafana/ui';

import { NotebookTagsField } from '../NotebookTagsField';
import { NotebookPickerList } from '../addPanel/NotebookPickerList';
import { useNotebookPicker } from '../addPanel/useNotebookPicker';
import { createNotebook } from '../api/notebookResource';
import { NotebookView } from '../embed/NotebookView';
import { canCreateNotebooks } from '../permissions';
import { defaultSpec } from '../types';

import { clearOpenSidePanelNotebook, setOpenSidePanelNotebook } from './openSidePanelNotebook';

const LAST_NOTEBOOK_STORAGE_KEY = 'grafana.notebooks.sidePanel.uid';

interface Props {
  onClose: () => void;
}

export function NotebooksSidePanel({ onClose }: Props) {
  const styles = useStyles2(getStyles);
  const [uid, setUid] = useState<string | undefined>(() => store.get(LAST_NOTEBOOK_STORAGE_KEY) || undefined);
  const [title, setTitle] = useState<string | undefined>();
  // Only a notebook created here should open straight into edit mode.
  const [justCreated, setJustCreated] = useState(false);

  const open = (nextUid: string | undefined, created = false) => {
    setUid(nextUid);
    setTitle(undefined);
    setJustCreated(created);
    if (nextUid) {
      store.set(LAST_NOTEBOOK_STORAGE_KEY, nextUid);
    } else {
      store.delete(LAST_NOTEBOOK_STORAGE_KEY);
    }
  };

  // Published for "Add to open notebook" elsewhere; the panel only mounts while docked, so cleanup
  // covers closing the sidebar as well as going back to the chooser.
  useEffect(() => {
    if (!uid) {
      return;
    }
    setOpenSidePanelNotebook({ uid, title: title ?? '' });
    return clearOpenSidePanelNotebook;
  }, [uid, title]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Stack alignItems="center" gap={1} minWidth={0}>
          {uid && (
            <IconButton
              name="arrow-left"
              aria-label={t('notebooks.side-panel.back', 'Back to notebooks')}
              onClick={() => open(undefined)}
            />
          )}
          <Text element="h2" variant="h5" truncate>
            {uid && title ? title : t('notebooks.side-panel.title', 'Notebooks')}
          </Text>
        </Stack>
        <IconButton name="times" aria-label={t('notebooks.side-panel.close', 'Close notebooks')} onClick={onClose} />
      </div>
      <div className={styles.body}>
        {uid ? (
          <NotebookView key={uid} uid={uid} enterEditMode={justCreated} onTitleChange={setTitle} />
        ) : (
          <NotebookChooser onOpen={open} />
        )}
      </div>
    </div>
  );
}

function NotebookChooser({ onOpen }: { onOpen: (uid: string, created?: boolean) => void }) {
  const styles = useStyles2(getStyles);
  const picker = useNotebookPicker();
  const canCreate = canCreateNotebooks();
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();

  const onCreate = async () => {
    setCreating(true);
    setCreateError(undefined);
    try {
      const created = await createNotebook({
        ...defaultSpec(),
        title: newTitle.trim() || `Notebook ${dateTime().format('YYYY-MM-DD HH:mm')}`,
      });
      onOpen(created.uid, true);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
      setCreating(false);
    }
  };

  return (
    <Stack direction="column" gap={3} height="100%">
      {canCreate && (
        <Stack direction="column" gap={1}>
          <Text element="h3" variant="h6">
            <Trans i18nKey="notebooks.side-panel.create-heading">Create a new notebook</Trans>
          </Text>
          <Stack gap={1}>
            <Input
              value={newTitle}
              placeholder={t('notebooks.side-panel.title-placeholder', 'Notebook title (optional)')}
              aria-label={t('notebooks.side-panel.title-label', 'New notebook title')}
              onChange={(e) => setNewTitle(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating) {
                  onCreate();
                }
              }}
            />
            <Button icon="plus" onClick={onCreate} disabled={creating}>
              <Trans i18nKey="notebooks.side-panel.create">Create</Trans>
            </Button>
          </Stack>
          {createError && <Text color="error">{createError}</Text>}
        </Stack>
      )}

      <Stack direction="column" gap={1} flex={1} minHeight={0}>
        <Text element="h3" variant="h6">
          <Trans i18nKey="notebooks.side-panel.open-heading">Open an existing notebook</Trans>
        </Text>
        <FilterInput
          value={picker.searchQuery}
          onChange={picker.setSearchQuery}
          placeholder={t('notebooks.side-panel.search-placeholder', 'Search notebooks')}
        />
        <Stack gap={1} alignItems="center">
          <NotebookTagsField
            value={picker.tagFilter}
            onChange={picker.setTagFilter}
            disabled={picker.isLoading}
            placeholder={t('notebooks.side-panel.tag-placeholder', 'Filter by tag')}
          />
          {picker.canFilterByMe && (
            <div className={styles.filterToggle}>
              <Checkbox
                value={picker.createdByMe}
                onChange={(event) => picker.setCreatedByMe(event.currentTarget.checked)}
                label={t('notebooks.side-panel.created-by-me', 'Created by me')}
              />
            </div>
          )}
        </Stack>
        <NotebookPickerList
          notebooks={picker.rows}
          isFiltered={picker.isFiltered}
          canCreate={canCreate}
          isLoading={picker.isLoading}
          isReloading={picker.isReloading}
          error={picker.error}
          isTruncated={picker.isTruncated}
          onSelect={(uid) => onOpen(uid)}
          fill
        />
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  filterToggle: css({
    display: 'flex',
    alignItems: 'center',
    minHeight: theme.spacing(theme.components.height.md),
    flexShrink: 0,
  }),
  body: css({
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: theme.spacing(2),
  }),
});
