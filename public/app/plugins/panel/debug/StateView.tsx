import { FormEvent } from 'react';

import { PanelOptionsEditorProps, PanelProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Field, Input, usePanelContext } from '@grafana/ui';

import { Options } from './panelcfg.gen';

export function StateView(props: PanelProps<Options>) {
  const context = usePanelContext();

  const onChangeName = (e: FormEvent<HTMLInputElement>) => {
    context.onInstanceStateChange!({
      name: e.currentTarget.value,
    });
  };

  return (
    <>
      <Field label={t('debug.state-view.label-state-name', 'State name')}>
        <Input value={context.instanceState?.name ?? ''} onChange={onChangeName} />
      </Field>
    </>
  );
}

export function StateViewEditor({ value, context, onChange, item }: PanelOptionsEditorProps<string>) {
  return (
    <div>
      <Trans i18nKey="debug.state-view.current-value" values={{ currentValue: context.instanceState?.name }}>
        Current value: {'{{currentValue}}'}{' '}
      </Trans>
    </div>
  );
}
