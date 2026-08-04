import { useMemo, useState } from 'react';

import { AppEvents, rangeUtil, type RawTimeRange, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type NotebookElement } from '@grafana/schema/apis/notebook/v2beta1';
import { Alert, Button, Checkbox, Field, Input, Modal, RadioButtonGroup, Select, Stack, Text } from '@grafana/ui';
import { useListNotebookQuery } from 'app/api/clients/dashboard/v2beta1';
import { extractErrorMessage } from 'app/api/utils';
import { appEvents } from 'app/core/app_events';

import { notebookEditUrl } from '../api/notebookAPI';
import { getLastUsedNotebook } from '../model/lastUsedNotebook';
import { newNotebookTitleDate } from '../model/notebookSpec';

import { addElementToNotebook, type AddToNotebookTarget } from './addToNotebook';

enum SaveTarget {
  New = 'new',
  Existing = 'existing',
}

export interface AddToNotebookFormProps {
  /** The element being added — a panel captured from a dashboard or Explore. */
  element: NotebookElement;
  /** Where the element came from, shown as context in the form. */
  sourceName?: string;
  /** Source time range; becomes the notebook time range when creating a new notebook. */
  timeRange?: RawTimeRange;
  onDismiss: () => void;
}

/**
 * The shared "Add to notebook" flow (Figma: click add to notebook → new notebook /
 * select existing → item added to draft notebook). Chrome-less so it can live in
 * the extension modal (Explore) and the panel-menu modal alike.
 */
export function AddToNotebookForm({ element, sourceName, timeRange, onDismiss }: AddToNotebookFormProps) {
  // Default to the most recently used notebook (the Figma's "default notebook" is
  // the last used one); fall back to creating a new notebook.
  const [lastUsed] = useState(getLastUsedNotebook);
  const [saveTarget, setSaveTarget] = useState<SaveTarget>(lastUsed ? SaveTarget.Existing : SaveTarget.New);
  const [title, setTitle] = useState(defaultTitle());
  const [existingUid, setExistingUid] = useState<string | undefined>(lastUsed?.uid);
  // An absolute source range means the user was looking at a specific window (e.g.
  // zoomed into a spike) — capture what they saw by defaulting the lock on. Relative
  // ranges ("last 6 hours") follow the notebook's time by default.
  const [lockTimeRange, setLockTimeRange] = useState(() =>
    Boolean(timeRange && !rangeUtil.isRelativeTimeRange(timeRange))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const { data, isLoading } = useListNotebookQuery({});

  const notebookOptions: Array<SelectableValue<string>> = useMemo(
    () =>
      (data?.items ?? [])
        .map((nb) => ({ label: nb.spec.title, value: nb.metadata.name ?? '' }))
        .filter((option) => option.value !== ''),
    [data]
  );

  const targets = [
    { label: t('notebooks.add-form.new', 'New notebook'), value: SaveTarget.New },
    {
      label: t('notebooks.add-form.existing', 'Existing notebook'),
      value: SaveTarget.Existing,
      description: notebookOptions.length === 0 ? t('notebooks.add-form.none-yet', 'No notebooks yet') : undefined,
    },
  ];

  const onSubmit = async (openAfter: boolean) => {
    setError(undefined);

    const target: AddToNotebookTarget =
      saveTarget === SaveTarget.New
        ? { type: 'new', title: title.trim() || defaultTitle() }
        : { type: 'existing', uid: existingUid ?? '' };

    if (target.type === 'existing' && !target.uid) {
      setError(t('notebooks.add-form.select-required', 'Select a notebook to add to.'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await addElementToNotebook(target, element, { timeRange, source: 'user', lockTimeRange });
      onDismiss();
      if (openAfter) {
        locationService.push(`${notebookEditUrl(result.uid)}?cell=${encodeURIComponent(result.elementName)}`);
      } else {
        appEvents.emit(AppEvents.alertSuccess, [t('notebooks.add-form.added', 'Added to notebook'), result.title]);
      }
    } catch (e) {
      setError(extractErrorMessage(e, t('notebooks.add-form.failed', 'Failed to add to notebook')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack direction="column" gap={1}>
      {sourceName && (
        <Text color="secondary" variant="bodySmall">
          <Trans i18nKey="notebooks.add-form.source">Adding a live panel from {{ sourceName }}.</Trans>
        </Text>
      )}

      <Field noMargin label={t('notebooks.add-form.target-label', 'Target notebook')}>
        <RadioButtonGroup options={targets} value={saveTarget} onChange={setSaveTarget} />
      </Field>

      {saveTarget === SaveTarget.New ? (
        <Field noMargin label={t('notebooks.add-form.title-label', 'Notebook name')}>
          <Input value={title} onChange={(e) => setTitle(e.currentTarget.value)} data-testid="add-to-notebook-title" />
        </Field>
      ) : (
        <Field noMargin label={t('notebooks.add-form.notebook-label', 'Notebook')}>
          <Select
            options={notebookOptions}
            isLoading={isLoading}
            value={existingUid}
            onChange={(option) => setExistingUid(option?.value)}
            placeholder={t('notebooks.add-form.notebook-placeholder', 'Choose a notebook')}
            data-testid="add-to-notebook-picker"
          />
        </Field>
      )}

      {timeRange && (
        // alignSelf keeps the checkbox's inline-grid hugging the left edge instead of
        // stretching (which centers its label/description in the modal).
        <div style={{ alignSelf: 'flex-start' }}>
          <Checkbox
            value={lockTimeRange}
            onChange={(e) => setLockTimeRange(e.currentTarget.checked)}
            label={t('notebooks.add-form.lock-time', 'Lock this panel to the current time window')}
            description={t('notebooks.add-form.lock-time-description', '{{from}} → {{to}}', absoluteRange(timeRange))}
          />
        </div>
      )}

      {error && (
        <Alert severity="error" title={t('notebooks.add-form.error-title', 'Could not add to notebook')}>
          {error}
        </Alert>
      )}

      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss} disabled={submitting}>
          <Trans i18nKey="notebooks.add-form.cancel">Cancel</Trans>
        </Button>
        <Button variant="secondary" onClick={() => onSubmit(false)} disabled={submitting} icon="book-open">
          <Trans i18nKey="notebooks.add-form.add">Add</Trans>
        </Button>
        <Button variant="primary" onClick={() => onSubmit(true)} disabled={submitting} icon="external-link-alt">
          <Trans i18nKey="notebooks.add-form.add-open">Add & open notebook</Trans>
        </Button>
      </Modal.ButtonRow>
    </Stack>
  );
}

function defaultTitle(): string {
  // Same dated shape as list/sidebar/command-palette creates (i18n-wrapped).
  return t('notebooks.add-form.default-title', 'Investigation — {{date}}', {
    date: newNotebookTitleDate(),
  });
}

function absoluteRange(raw: RawTimeRange): { from: string; to: string } {
  const range = rangeUtil.convertRawToRange(raw);
  return { from: range.from.format('YYYY-MM-DD HH:mm'), to: range.to.format('YYYY-MM-DD HH:mm') };
}
