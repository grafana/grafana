import { css } from '@emotion/css';
import { type ReactNode, useMemo, useState } from 'react';
import { type DefaultValues, type FieldValues, useForm, type UseFormReturn } from 'react-hook-form';

import { type DataSourceInstanceListItem, type GrafanaTheme2, store } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, Button, IconButton, Modal, Stack, useStyles2 } from '@grafana/ui';
import { useStoredString } from 'app/core/hooks/useStored';

import { ctaClicked, solutionFilterChanged } from '../analytics/main';
import { type SolutionFilterChanged } from '../analytics/types';
import { type DatasourceBoundFilter, scopeFor, solutionFilterStorageKey } from '../solutions/solutionFilter';
import { type SolutionId } from '../solutions/types';

/** What a solution contributes to the shared filter dialog. The scope is its stored filter minus the datasource binding. */
export interface SolutionFilterSpec<TScope extends FieldValues> {
  solution: SolutionId;
  parse: (raw: string | undefined) => (DatasourceBoundFilter & TScope) | null;
  /** Summary of an applied filter for the gear tooltip. */
  summarize: (filter: DatasourceBoundFilter & TScope) => string;
  /**
   * Values the dialog starts from: the stored filter's scope, even one saved for another datasource
   * so it can be re-saved or cleared, else the solution's empty scope. The datasource binding stays
   * out of the form; this card's is added on save.
   */
  defaultValues: (filter: (DatasourceBoundFilter & TScope) | null) => DefaultValues<TScope>;
  /** Whether the values narrow anything; Save stays disabled until they do. */
  hasSelection: (scope: TScope) => boolean;
  /** Names of the dimensions a scope sets, for analytics; the values are customer data and never leave the browser. */
  customized: (scope: TScope) => string;
}

/** Props every card filter control takes; the card renders it once the solution's datasource resolved. */
export interface CardFilterActionsProps {
  /** Datasource the card reads; a filter saved for another one is shown as not applied. */
  datasource: DataSourceInstanceListItem;
}

interface SolutionFilterActionsProps<TScope extends FieldValues> extends CardFilterActionsProps {
  spec: SolutionFilterSpec<TScope>;
  /** Gear tooltip while no filter is applied. */
  openLabel: string;
  title: string;
  /** The dialog's fields, registered on the form; each field carries its own validation rule. */
  children: (form: UseFormReturn<TScope>) => ReactNode;
}

export function SolutionFilterActions<TScope extends FieldValues>({
  spec,
  datasource,
  openLabel,
  title,
  children,
}: SolutionFilterActionsProps<TScope>) {
  const styles = useStyles2(getStyles);
  const [raw] = useStoredString(solutionFilterStorageKey(spec.solution), '');
  const filter = useMemo(() => spec.parse(raw), [spec, raw]);
  const applied = scopeFor(filter, datasource);
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
                summary: spec.summarize(applied),
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

interface SolutionFilterModalProps<TScope extends FieldValues> {
  spec: SolutionFilterSpec<TScope>;
  datasource: DataSourceInstanceListItem;
  filter: (DatasourceBoundFilter & TScope) | null;
  title: string;
  onClose: () => void;
  children: (form: UseFormReturn<TScope>) => ReactNode;
}

// Mounted only while open, so the form starts from the stored filter each time.
function SolutionFilterModal<TScope extends FieldValues>({
  spec,
  datasource,
  filter,
  title,
  onClose,
  children,
}: SolutionFilterModalProps<TScope>) {
  // Fields validate as they change, so a mistake shows where it is made.
  const form = useForm<TScope>({ defaultValues: spec.defaultValues(filter), mode: 'onChange' });
  const values = form.watch();
  const [error, setError] = useState<string | null>(null);

  const storageKey = solutionFilterStorageKey(spec.solution);
  // Persist, report, then close; a quota or access failure keeps the dialog and values so the user
  // can retry, and reports nothing.
  const persist = (write: () => void, change: SolutionFilterChanged['change'], customized: string) => {
    try {
      write();
    } catch {
      setError(t('home.solutions.filter.save-failed', 'Could not save to browser storage. Try again.'));
      return;
    }
    solutionFilterChanged({ solution: spec.solution, change, customized });
    onClose();
  };
  const save = form.handleSubmit((scope) =>
    persist(
      () => {
        const next: DatasourceBoundFilter & TScope = {
          ...scope,
          datasourceUid: datasource.uid,
          datasourceName: datasource.name,
        };
        store.setObject(storageKey, next);
      },
      'saved',
      spec.customized(scope)
    )
  );
  const clear = () => persist(() => store.delete(storageKey), 'cleared', '');

  return (
    <Modal isOpen title={title} onDismiss={onClose}>
      <form onSubmit={save}>
        <Stack direction="column" gap={2}>
          {children(form)}
          {error && <Alert severity="error" title={error} />}
        </Stack>
        <Modal.ButtonRow
          leftItems={
            filter && (
              <Button variant="secondary" fill="outline" onClick={clear}>
                <Trans i18nKey="home.solutions.filter.clear">Clear filters</Trans>
              </Button>
            )
          }
        >
          <Button variant="secondary" onClick={onClose}>
            <Trans i18nKey="home.solutions.filter.cancel">Cancel</Trans>
          </Button>
          <Button type="submit" disabled={!form.formState.isValid || !spec.hasSelection(values)}>
            <Trans i18nKey="home.solutions.filter.save">Save</Trans>
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  applied: css({
    // An applied filter narrows what the card reports, alerts included, so the gear keeps the
    // warning color whatever group the card sits in; `&&` outranks IconButton's own color.
    '&&': {
      color: theme.colors.warning.text,
    },
  }),
});
