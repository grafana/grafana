import { t, Trans } from '@grafana/i18n';
import { Alert, ScrollContainer, Spinner, Stack, Text } from '@grafana/ui';

import { type NotebookRow } from '../list/useNotebooksList';

import { NotebookPickerCard } from './NotebookPickerCard';

/**
 * The list is meant to be the modal's only scroll region — the tabs, filters and footer should stay
 * put while it scrolls. Modal caps itself at 80% of the viewport and the rest of the modal takes
 * roughly 360px of that, so the list gets what is left.
 *
 * Bounded in viewport units rather than by flexing to fill the space: the two entry points render
 * different modal wrappers (Explore's plugin-extension wrapper adds a plain div of its own), and
 * neither gives this component a definite height to flex against.
 *
 * The 200px floor only matters on a very short screen, where the modal falls back to scrolling
 * itself — better than a list too short to show a single notebook. It stays inside the max so a
 * short list is still sized by its content rather than padded out to the floor.
 */
const LIST_MAX_HEIGHT = 'max(200px, calc(80vh - 360px))';

interface Props {
  notebooks: NotebookRow[];
  /** Notebooks before filtering, to tell "none exist" apart from "none matched". */
  totalCount: number;
  isLoading: boolean;
  error?: unknown;
  /** The server had more than one page, so this list is not the whole library. */
  isTruncated: boolean;
  selectedUid?: string;
  onSelect: (uid: string) => void;
}

export function NotebookPickerList({
  notebooks,
  totalCount,
  isLoading,
  error,
  isTruncated,
  selectedUid,
  onSelect,
}: Props) {
  if (isLoading) {
    return (
      <Stack justifyContent="center" alignItems="center">
        <Spinner />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="error" title={t('notebooks.add-panel.list-error', 'Failed to load notebooks')}>
        <Trans i18nKey="notebooks.add-panel.list-error-body">
          Something went wrong loading your notebooks. Try again, or create a new one instead.
        </Trans>
      </Alert>
    );
  }

  if (notebooks.length === 0) {
    return (
      <Stack direction="column" alignItems="center" gap={1}>
        <Text color="secondary">
          {totalCount === 0 ? (
            <Trans i18nKey="notebooks.add-panel.list-none">You have no notebooks yet. Create one instead.</Trans>
          ) : (
            <Trans i18nKey="notebooks.add-panel.list-no-matches">No notebooks match these filters.</Trans>
          )}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack direction="column" gap={1}>
      <ScrollContainer maxHeight={LIST_MAX_HEIGHT}>
        <Stack direction="column" gap={1}>
          {notebooks.map((notebook) => (
            <NotebookPickerCard
              key={notebook.uid}
              notebook={notebook}
              isSelected={notebook.uid === selectedUid}
              onSelect={onSelect}
            />
          ))}
        </Stack>
      </ScrollContainer>

      {/* Filtering is client-side over one page, so a larger library is only partly searchable here. */}
      {isTruncated && (
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="notebooks.add-panel.list-truncated">
            Only your most recent notebooks are shown. Narrow the search to find others.
          </Trans>
        </Text>
      )}
    </Stack>
  );
}
