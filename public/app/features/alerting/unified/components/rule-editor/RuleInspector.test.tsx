import { fireEvent } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, renderHook, screen } from 'test/test-utils';

import { mockBoundingClientRect } from '@grafana/test-utils';

import { getDefaultFormValues } from '../../rule-editor/formDefaults';
import { RuleFormType, type RuleFormValues } from '../../types/rule-form';

import { RuleInspector } from './RuleInspector';

async function setup(type = RuleFormType.cloudAlerting) {
  const { result } = renderHook(() =>
    useForm<RuleFormValues>({
      defaultValues: {
        ...getDefaultFormValues(),
        type,
        name: 'Original rule',
        expression: 'up == 0',
        forTime: 5,
        forTimeUnit: 'm',
        annotations: [],
        labels: [],
        dataSourceName: 'Mimir',
        namespace: 'production',
        group: 'alerts',
      },
    })
  );
  const onClose = jest.fn();
  const { user } = render(
    <FormProvider {...result.current}>
      <RuleInspector onClose={onClose} />
    </FormProvider>
  );
  const editor = await screen.findByRole('textbox', { name: 'Alert rule YAML' });

  return { user, editor, form: result.current, onClose };
}

beforeAll(() => {
  mockBoundingClientRect();
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(500);
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('RuleInspector', () => {
  it('applies the latest alerting YAML when clicking Apply blurs the focused editor', async () => {
    const { user, editor, form, onClose } = await setup();
    expect(editor).toHaveTextContent('alert: Original rule');
    expect(editor).toHaveTextContent('for: 5m');
    expect(editor).toHaveTextContent('expr: up == 0');

    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}');
    await user.paste(
      'alert: Edited rule\nexpr: up == 1\nfor: 10m\nkeep_firing_for: 2m\nlabels:\n  severity: warning\nannotations:\n  summary: Edited summary\n'
    );

    expect(editor).toHaveFocus();
    expect(editor).toHaveTextContent('summary: Edited summary');
    expect(form.getValues('name')).toBe('Original rule');

    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(form.getValues()).toMatchObject({
      name: 'Edited rule',
      expression: 'up == 1',
      forTime: 10,
      forTimeUnit: 'm',
      keepFiringForTime: 2,
      keepFiringForTimeUnit: 'm',
      labels: [
        { key: 'severity', value: 'warning' },
        { key: '', value: '' },
      ],
      annotations: [{ key: 'summary', value: 'Edited summary' }],
      dataSourceName: 'Mimir',
      namespace: 'production',
      group: 'alerts',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps unblurred edits out of the YAML committed for Apply', async () => {
    const { user, editor, form } = await setup();
    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('alert: Committed rule\nexpr: up == 1\nfor: 10m\n');
    await user.click(screen.getByRole('tab', { name: 'Yaml' }));

    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('alert: Uncommitted rule\nexpr: up == 2\nfor: 20m\n');
    expect(editor).toHaveFocus();
    expect(editor).toHaveTextContent('alert: Uncommitted rule');

    // eslint-disable-next-line testing-library/prefer-user-event -- userEvent.click blurs the editor before activating Apply.
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(form.getValues()).toMatchObject({
      name: 'Committed rule',
      expression: 'up == 1',
      forTime: 10,
      forTimeUnit: 'm',
    });
  });

  it('preserves recording rule conversion when applying edited YAML', async () => {
    const { user, editor, form, onClose } = await setup(RuleFormType.cloudRecording);
    expect(editor).toHaveTextContent('record: Original rule');

    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('record: job:up:sum\nexpr: sum(up)\nlabels:\n  team: alerting\n');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(form.getValues()).toMatchObject({
      type: RuleFormType.cloudRecording,
      name: 'job:up:sum',
      expression: 'sum(up)',
      labels: [
        { key: 'team', value: 'alerting' },
        { key: '', value: '' },
      ],
      dataSourceName: 'Mimir',
      namespace: 'production',
      group: 'alerts',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
