import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Box, ScrollContainer, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

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
  /** Whether any filter is applied, to tell "none exist" apart from "none matched". */
  isFiltered: boolean;
  /** Whether the reader can create one, so an empty library only suggests it when they could. */
  canCreate: boolean;
  /** The first load, when there is nothing to show yet. */
  isLoading: boolean;
  /**
   * A new set of filters is in flight and nothing is held for them yet, so the rows above are empty
   * rather than stale. Distinct from `isLoading`, which is only ever true once.
   */
  isReloading: boolean;
  error?: unknown;
  /** The server had more than one page, so this list is not the whole library. */
  isTruncated: boolean;
  selectedUid?: string;
  onSelect: (uid: string) => void;
}

export function NotebookPickerList({
  notebooks,
  isFiltered,
  canCreate,
  isLoading,
  isReloading,
  error,
  isTruncated,
  selectedUid,
  onSelect,
}: Props) {
  const styles = useStyles2(getStyles);

  // Reloading counts as loading here: the rows are empty because the answer has not arrived, and
  // saying "no notebooks match these filters" in the meantime claims a result we do not have.
  if (isLoading || isReloading) {
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
          {!isFiltered ? (
            // Pointing at the create tab is only advice if the reader has one. Adding to an existing
            // notebook needs dashboards:write and creating needs dashboards:create, so a reader can
            // open this picker with no way to make the notebook it is telling them to make.
            canCreate ? (
              <Trans i18nKey="notebooks.add-panel.list-none">You have no notebooks yet. Create one instead.</Trans>
            ) : (
              <Trans i18nKey="notebooks.add-panel.list-none-read-only">
                You have no notebooks yet, and no permission to create one.
              </Trans>
            )
          ) : (
            <Trans i18nKey="notebooks.add-panel.list-no-matches">No notebooks match these filters.</Trans>
          )}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack direction="column" gap={1}>
      {/* The room for a card's focus ring has to be *inside* the scrolling element: ScrollContainer
          puts its own `padding` on an outer Box, while the inner div is the one with `overflow: auto`
          doing the clipping, so padding the component only insets the whole list. Hence the Box in
          here instead. A full spacing unit, because the widest thing to clear is not the card's 1px
          border or its 1px selected outline but its focus ring, which sits 2px out and extends 4px
          past that.

          Overflow cannot simply be turned off instead: a box with `overflow-y: auto` coerces a
          `visible` overflow-x to `auto`, so the ring would still be clipped, only with a stray
          horizontal scrollbar to go with it.

          The wrapper pulls the scroll area back out by the same amount, so the cards still line up
          with the filters above rather than sitting inset from them. */}
      <div className={styles.bleed}>
        <ScrollContainer maxHeight={LIST_MAX_HEIGHT} overflowX="hidden">
          <Box padding={1}>
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
          </Box>
        </ScrollContainer>
      </div>

      {/* Only on a library big enough to hit the search's accumulation ceiling: every page before
          that is followed. Narrowing genuinely helps, because the filters are part of the query, but
          it does not say "most recent" - the server ranks by relevance for a text query and by name
          otherwise, and the list is not scoped to the reader unless they ask for that. */}
      {isTruncated && (
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="notebooks.add-panel.list-truncated">
            Not every notebook is shown. Narrow the search to find others.
          </Trans>
        </Text>
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Cancels the inner padding above horizontally, so the cards keep the modal's own content edge.
  // Only horizontally: the vertical padding is wanted, as breathing room at either end of the scroll.
  bleed: css({
    marginLeft: `-${theme.spacing(1)}`,
    marginRight: `-${theme.spacing(1)}`,
  }),
});
