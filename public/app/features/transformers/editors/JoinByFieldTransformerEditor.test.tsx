import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { toDataFrame, FieldType, type TransformerUIProps } from '@grafana/data';
import { type JoinByFieldOptions, JoinMode } from '@grafana/data/internal';

import { SeriesToFieldsTransformerEditor } from './JoinByFieldTransformerEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({ getVariables: () => [] }),
}));

const input = [
  toDataFrame({
    refId: 'A',
    fields: [
      { name: 'GA', type: FieldType.string, values: ['a'] },
      { name: 'PA', type: FieldType.string, values: ['x'] },
    ],
  }),
];

const setup = (options: JoinByFieldOptions = {}) => {
  const onChange = jest.fn();
  const props: TransformerUIProps<JoinByFieldOptions> = { input, options, onChange };
  render(<SeriesToFieldsTransformerEditor {...props} />);
  return { onChange };
};

describe('JoinByFieldTransformerEditor', () => {
  it('disables Keep unjoined until a field is selected', () => {
    setup({ mode: JoinMode.outer });

    expect(screen.getByLabelText('Keep unjoined')).toBeDisabled();
    expect(screen.getByLabelText('Keep unjoined')).not.toBeChecked();
  });

  it('enables Keep unjoined once a field is selected', () => {
    setup({ byField: 'GA', mode: JoinMode.outer });

    expect(screen.getByLabelText('Keep unjoined')).toBeEnabled();
  });

  it('reflects a saved keepUnjoinedFrames value', () => {
    setup({ byField: 'GA', mode: JoinMode.outer, keepUnjoinedFrames: true });

    expect(screen.getByLabelText('Keep unjoined')).toBeChecked();
  });

  it('does not show as checked when a field was cleared but the flag remains', () => {
    // guards against a stale saved flag reading as active while it has no effect
    setup({ mode: JoinMode.outer, keepUnjoinedFrames: true });

    expect(screen.getByLabelText('Keep unjoined')).not.toBeChecked();
  });

  it('toggles keepUnjoinedFrames on without dropping other options', async () => {
    const { onChange } = setup({ byField: 'GA', mode: JoinMode.inner });

    await userEvent.click(screen.getByLabelText('Keep unjoined'));

    expect(onChange).toHaveBeenCalledWith({
      byField: 'GA',
      mode: JoinMode.inner,
      keepUnjoinedFrames: true,
    });
  });

  it('toggles keepUnjoinedFrames back off', async () => {
    const { onChange } = setup({ byField: 'GA', mode: JoinMode.outer, keepUnjoinedFrames: true });

    await userEvent.click(screen.getByLabelText('Keep unjoined'));

    expect(onChange).toHaveBeenCalledWith({
      byField: 'GA',
      mode: JoinMode.outer,
      keepUnjoinedFrames: false,
    });
  });
});
