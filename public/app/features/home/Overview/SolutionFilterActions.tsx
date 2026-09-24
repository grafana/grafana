import { css } from '@emotion/css';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { type DataSourceInstanceListItem, type GrafanaTheme2, store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, Button, IconButton, Modal, Stack, useStyles2 } from '@grafana/ui';
import { useStoredString } from 'app/core/hooks/useStored';

import { ctaClicked, solutionFilterChanged } from '../analytics/main';
import { type SolutionFilterChanged } from '../analytics/types';
import { type DatasourceBoundFilter, solutionFilterStorageKey } from '../solutions/solutionFilter';
import { type SolutionId } from '../solutions/types';

/** What a solution contributes to the shared filter dialog. The scope is its stored filter minus the datasource binding. */
export interface SolutionFilterSpec<TScope extends object> {
  solution: SolutionId;
  parse: (raw: string | undefined) => (DatasourceBoundFilter & TScope) | null;
  /** Summary of an applied filter for the gear tooltip. */
  summarize: (filter: DatasourceBoundFilter & TScope) => string;
  /** Draft the dialog starts from when nothing is stored. */
  emptyScope: TScope;
  hasSelection: (scope: TScope) => boolean;
  /** Names of the dimensions a scope sets, for analytics; the values are customer data and never leave the browser. */
  customized: (scope: TScope) => string;
  /** Runs before a save; a message keeps the dialog open and shows it instead of saving. */
  validate?: (scope: TScope, datasource: DataSourceInstanceListItem) => Promise<string | null>;
}

/** Props every card filter control takes; the card renders it once the solution's datasource resolved. */
export interface CardFilterActionsProps {
  /** Datasource the card reads; a filter saved for another one is shown as not applied. */
  datasource: DataSourceInstanceListItem;
  /** Whether the card's action is the attention one, so the applied gear takes the same text color. */
  attention: boolean;
}

interface SolutionFilterActionsProps<TScope extends object> extends CardFilterActionsProps {
  spec: SolutionFilterSpec<TScope>;
  /** Gear tooltip while no filter is applied. */
  openLabel: string;
  title: string;
  /** The dialog's fields, editing the drafted scope. */
  children: (scope: TScope, onChange: (scope: TScope) => void) => ReactNode;
}

export function SolutionFilterActions<TScope extends object>({
  spec,
  datasource,
  attention,
  openLabel,
  title,
  children,
}: SolutionFilterActionsProps<TScope>) {
  const styles = useStyles2(getStyles, attention);
  const [raw] = useStoredString(solutionFilterStorageKey(spec.solution), '');
  const filter = useMemo(() => spec.parse(raw), [spec, raw]);
  const applied = filter !== null && filter.datasourceUid === datasource.uid;
  const [open, setOpen] = useState(false);

  return (
    <>
      {filter && !applied && (
        <Badge
          color="darkgrey"
          icon="info-circle"
          text={t('home.solutions.filter.badge-ignored', 'Filters not applied')}
          tooltip={t(
            'home.solutions.filter.ignored-tooltip',
            'Saved for {{saved}}. This card reads {{current}}, so it shows the whole fleet.',
            { saved: filter.datasourceName, current: datasource.name, interpolation: { escapeValue: false } }
          )}
        />
      )}
      {/* The highlighted gear is the only sign a filter is applied, so its tooltip carries the selection. */}
      <IconButton
        name="cog"
        tooltip={
          applied
            ? t('home.solutions.filter.edit', 'Edit filters ({{summary}})', {
                summary: spec.summarize(filter),
                interpolation: { escapeValue: false },
              })
            : openLabel
        }
        className={applied ? styles.applied : undefined}
        onClick={() => {
          setOpen(true);
          ctaClicked({
            surface: 'overview',
            action: 'open_solution_filter',
            placement: 'card',
            solution: spec.solution,
          });
        }}
      />
      {open && (
        <SolutionFilterModal
          spec={spec}
          datasource={datasource}
          filter={filter}
          title={title}
          onClose={() => setOpen(false)}
        >
          {children}
        </SolutionFilterModal>
      )}
    </>
  );
}

interface SolutionFilterModalProps<TScope extends object> {
  spec: SolutionFilterSpec<TScope>;
  datasource: DataSourceInstanceListItem;
  filter: (DatasourceBoundFilter & TScope) | null;
  title: string;
  onClose: () => void;
  children: (scope: TScope, onChange: (scope: TScope) => void) => ReactNode;
}

// Mounted only while open, so the draft starts from the stored filter each time.
function SolutionFilterModal<TScope extends object>({
  spec,
  datasource,
  filter,
  title,
  onClose,
  children,
}: SolutionFilterModalProps<TScope>) {
  // The draft starts from the stored filter even when it was saved for another datasource, so the
  // user can re-save it for this one or clear it. Its old binding rides along and is overwritten on save.
  const [draft, setDraft] = useState<TScope>(() => filter ?? spec.emptyScope);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  // A validation still running when the dialog is dismissed must not save or report afterwards.
  const closed = useRef(false);
  useEffect(
    () => () => {
      closed.current = true;
    },
    []
  );

  const storageKey = solutionFilterStorageKey(spec.solution);
  // Persist, report, then close; a quota or access failure keeps the dialog and draft so the user
  // can retry, and reports nothing.
  const persist = (write: () => void, change: SolutionFilterChanged['change'], scope: TScope) => {
    try {
      write();
    } catch {
      setError(t('home.solutions.filter.save-failed', 'Could not save to browser storage. Try again.'));
      return;
    }
    solutionFilterChanged({ solution: spec.solution, change, customized: spec.customized(scope) });
    onClose();
  };
  const save = async () => {
    if (spec.validate) {
      setError(null);
      setValidating(true);
      const message = await spec
        .validate(draft, datasource)
        .catch((reason: unknown) => (reason instanceof Error ? reason.message : String(reason)));
      if (closed.current) {
        return;
      }
      setValidating(false);
      if (message) {
        setError(message);
        return;
      }
    }
    persist(
      () => {
        const next: DatasourceBoundFilter & TScope = {
          ...draft,
          datasourceUid: datasource.uid,
          datasourceName: datasource.name,
        };
        store.setObject(storageKey, next);
      },
      'saved',
      draft
    );
  };
  const clear = () => persist(() => store.delete(storageKey), 'cleared', spec.emptyScope);

  return (
    <Modal isOpen title={title} onDismiss={onClose}>
      <Stack direction="column" gap={2}>
        {children(draft, setDraft)}
        {error && <Alert severity="error" title={error} />}
      </Stack>
      <Modal.ButtonRow
        leftItems={
          filter && (
            <Button variant="secondary" fill="outline" onClick={clear} disabled={validating}>
              <Trans i18nKey="home.solutions.filter.clear">Clear filters</Trans>
            </Button>
          )
        }
      >
        <Button variant="secondary" onClick={onClose}>
          <Trans i18nKey="home.solutions.filter.cancel">Cancel</Trans>
        </Button>
        <Button onClick={save} disabled={validating || !spec.hasSelection(draft)}>
          <Trans i18nKey="home.solutions.filter.save">Save</Trans>
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2, attention: boolean) => ({
  applied: css({
    // The card's text-fill action is accent-colored, or warning-colored when it points at alerts;
    // `&&` outranks IconButton's own color.
    '&&': {
      color: attention ? theme.colors.warning.text : theme.colors.accent.text,
    },
  }),
});
