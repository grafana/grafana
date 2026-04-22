import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { UnitValueEditor } from './units';

jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  return {
    ...actual,
    UnitPicker: jest.fn(({ id }: { id?: string }) => <div data-testid={`unit-picker-${id ?? 'none'}`} />),
  };
});

describe('UnitValueEditor', () => {
  it('renders UnitPicker alone when not clearable', () => {
    render(
      <UnitValueEditor
        value="bytes"
        onChange={jest.fn()}
        item={{ settings: {} } as Parameters<typeof UnitValueEditor>[0]['item']}
        context={{ data: [] }}
        id="u1"
      />
    );

    expect(screen.getByTestId('unit-picker-u1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('shows clear control when clearable and a value is set', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();

    render(
      <UnitValueEditor
        value="short"
        onChange={onChange}
        item={{ settings: { isClearable: true } } as Parameters<typeof UnitValueEditor>[0]['item']}
        context={{ data: [] }}
        id="u2"
      />
    );

    await user.click(screen.getByRole('button', { name: /clear unit selection/i }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
