import { useId, useState } from 'react';

import { type Slideshow } from '@grafana/api-clients/rtkq/collections/v1alpha1';
import { locationUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, FieldSet, Input, LinkButton, Stack } from '@grafana/ui';

import { AddSlideshowItem } from './AddSlideshowItem';
import { SlideshowItemRows } from './SlideshowItemRows';
import { type SlideshowItemDraft } from './types';

interface Props {
  slideshow: Slideshow;
  onSubmit: (slideshow: Slideshow) => void | Promise<void>;
}

// The same rule the API applies: one whole number and one unit, from 10 seconds to 24 hours.
const INTERVAL = /^([0-9]+)(ms|s|m|h|d|w|M|y)$/;
const UNIT_MS: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
const MIN_INTERVAL_MS = 10_000;
const MAX_INTERVAL_MS = 86_400_000;

function isValidInterval(value: string): boolean {
  const match = INTERVAL.exec(value);
  const unit = match ? UNIT_MS[match[2]] : undefined;
  if (!match || unit === undefined) {
    return false;
  }
  const ms = Number(match[1]) * unit;
  return ms >= MIN_INTERVAL_MS && ms <= MAX_INTERVAL_MS;
}

export function SlideshowForm({ slideshow, onSubmit }: Props) {
  const titleId = useId();
  const intervalId = useId();
  const [title, setTitle] = useState(slideshow.spec.title);
  const [interval, setInterval] = useState(slideshow.spec.interval);
  const [items, setItems] = useState<SlideshowItemDraft[]>(slideshow.spec.items ?? []);
  const [saving, setSaving] = useState(false);

  const move = (from: number, to: number) => {
    const next = [...items];
    next.splice(to, 0, ...next.splice(from, 1));
    setItems(next);
  };

  const intervalsValid =
    isValidInterval(interval) && items.every((item) => !item.interval || isValidInterval(item.interval));

  const canSave = !!title.trim() && items.length > 0 && intervalsValid;

  const submit = async () => {
    if (saving || !canSave) {
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...slideshow,
        spec: {
          title,
          interval,
          // Only the stored fields are sent, with a blank per-item interval left out.
          items: items.map(({ group, resource, name, interval }) => ({
            group,
            resource,
            name,
            ...(interval ? { interval } : {}),
          })),
        },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Stack direction="column" gap={3}>
        <Field noMargin label={t('slideshows.edit.title-label', 'Title')} htmlFor={titleId}>
          <Input id={titleId} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        </Field>
        <Field
          noMargin
          label={t('slideshows.edit.interval-label', 'Interval')}
          htmlFor={intervalId}
          invalid={!isValidInterval(interval)}
          error={t(
            'slideshows.edit.interval-invalid',
            'Use a whole number and a unit, from 10s to 24h, such as 30s or 5m'
          )}
        >
          <Input id={intervalId} value={interval} onChange={(e) => setInterval(e.currentTarget.value)} />
        </Field>

        <FieldSet label={t('slideshows.edit.items-heading', 'Items')}>
          <SlideshowItemRows
            items={items}
            defaultInterval={interval}
            onDelete={(i) => setItems(items.filter((_, idx) => idx !== i))}
            onMove={move}
            onIntervalChange={(i, value) =>
              setItems(items.map((item, idx) => (idx === i ? { ...item, interval: value } : item)))
            }
          />
        </FieldSet>

        <FieldSet label={t('slideshows.edit.add-heading', 'Add items')}>
          <AddSlideshowItem onAdd={(item) => setItems([...items, item])} />
        </FieldSet>

        <Stack>
          <Button type="submit" disabled={!canSave || saving} icon={saving ? 'spinner' : undefined}>
            <Trans i18nKey="slideshows.edit.save">Save</Trans>
          </Button>
          <LinkButton variant="secondary" href={locationUtil.assureBaseUrl('/slideshows')}>
            <Trans i18nKey="slideshows.edit.cancel">Cancel</Trans>
          </LinkButton>
        </Stack>
      </Stack>
    </form>
  );
}
