import { useState } from 'react';

import { t } from '@grafana/i18n';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, Field, Modal, Stack } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { SIGNALS, SIGNAL_TYPES, type Signal, dataSourceParam, signalLabels } from './dataSources';

export function DataSourcesButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button icon="database" size="sm" variant="secondary" fill="outline" onClick={() => setOpen(true)}>
        {t('drilldown-datasources.button', 'Data sources')}
      </Button>
      {open && <DataSourcesModal onDismiss={() => setOpen(false)} />}
    </>
  );
}

// Page replaces only the heading with this, so the heading is drawn here and the button follows it in the same row.
export function renderDrilldownTitle(title: string) {
  return (
    <>
      <h1>{title}</h1>
      <DataSourcesButton />
    </>
  );
}

// The modal holds what the user picks until Apply, so a change reloads the page once and not once per picker.
function DataSourcesModal({ onDismiss }: { onDismiss: () => void }) {
  const [queryParams, updateQueryParams] = useQueryParams();
  const labels = signalLabels();
  const [picked, setPicked] = useState<Partial<Record<Signal, string>>>({});

  const saved = (signal: Signal) => {
    const value = queryParams[dataSourceParam(signal)];
    return typeof value === 'string' ? value : null;
  };
  const changed = SIGNALS.filter((signal) => picked[signal] !== undefined && picked[signal] !== saved(signal));

  const apply = () => {
    updateQueryParams(Object.fromEntries(changed.map((signal) => [dataSourceParam(signal), picked[signal]])));
    onDismiss();
  };

  return (
    <Modal isOpen title={t('drilldown-datasources.modal-title', 'Data sources')} onDismiss={onDismiss}>
      <Stack direction="column" gap={2}>
        {SIGNALS.map((signal) => {
          const inputId = `drilldown-data-source-${signal}`;
          return (
            <Field key={signal} label={labels[signal]} htmlFor={inputId} noMargin>
              <DataSourcePicker
                inputId={inputId}
                type={SIGNAL_TYPES[signal]}
                current={picked[signal] ?? saved(signal)}
                noDefault
                onChange={(dataSource) => setPicked((previous) => ({ ...previous, [signal]: dataSource.uid }))}
              />
            </Field>
          );
        })}
      </Stack>
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button disabled={changed.length === 0} onClick={apply}>
          {t('common.apply', 'Apply')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}
