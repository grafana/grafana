import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, type Threshold, ThresholdsMode } from '@grafana/data';
import { mockThemeContext } from '@grafana/ui';

import { ThresholdsEditor, type Props } from './ThresholdsEditor';

let props: Props;

const setup = (propOverrides?: Partial<Props>) => {
  props = {
    onChange: jest.fn(),
    thresholds: { mode: ThresholdsMode.Absolute, steps: [] },
  };
  Object.assign(props, propOverrides);

  render(<ThresholdsEditor {...props} />);
};

describe('ThresholdsEditor', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  it('should render with an uneditable base threshold', () => {
    setup();
    const baseThreshold = screen.getByRole('textbox', { name: 'Threshold 1' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');
  });

  it('should have an "Add threshold" button', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Add threshold' });
    expect(button).toBeInTheDocument();
  });

  it('can add thresholds', async () => {
    setup();

    // only the base threshold input
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    let baseThreshold = screen.getByRole('textbox', { name: 'Threshold 1' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');

    await userEvent.click(screen.getByRole('button', { name: 'Add threshold' }));

    expect(screen.getAllByRole('textbox')).toHaveLength(2);

    let customThreshold = screen.getByRole('textbox', { name: 'Threshold 1' });
    expect(customThreshold).toBeInTheDocument();
    expect(customThreshold).not.toBeDisabled();
    expect(customThreshold).toHaveValue('0');

    baseThreshold = screen.getByRole('textbox', { name: 'Threshold 2' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');

    await userEvent.click(screen.getByRole('button', { name: 'Add threshold' }));

    expect(screen.getAllByRole('textbox')).toHaveLength(3);

    let customThreshold2 = screen.getByRole('textbox', { name: 'Threshold 1' });
    expect(customThreshold2).toBeInTheDocument();
    expect(customThreshold2).not.toBeDisabled();
    expect(customThreshold2).toHaveValue('10');

    customThreshold = screen.getByRole('textbox', { name: 'Threshold 2' });
    expect(customThreshold).toBeInTheDocument();
    expect(customThreshold).not.toBeDisabled();
    expect(customThreshold).toHaveValue('0');

    baseThreshold = screen.getByRole('textbox', { name: 'Threshold 3' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');
  });

  it('can remove thresholds', async () => {
    const thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: '#7EB26D' },
        { value: 50, color: '#EAB839' },
        { value: 75, color: '#6ED0E0' },
      ],
    };
    setup({ thresholds });

    expect(screen.getAllByRole('textbox')).toHaveLength(3);

    let customThreshold2 = screen.getByRole('textbox', { name: 'Threshold 1' });
    expect(customThreshold2).toBeInTheDocument();
    expect(customThreshold2).not.toBeDisabled();
    expect(customThreshold2).toHaveValue('75');

    let customThreshold = screen.getByRole('textbox', { name: 'Threshold 2' });
    expect(customThreshold).toBeInTheDocument();
    expect(customThreshold).not.toBeDisabled();
    expect(customThreshold).toHaveValue('50');

    let baseThreshold = screen.getByRole('textbox', { name: 'Threshold 3' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');

    await userEvent.click(screen.getByRole('button', { name: 'Remove threshold 1' }));

    expect(screen.getAllByRole('textbox')).toHaveLength(2);

    customThreshold = screen.getByRole('textbox', { name: 'Threshold 1' });
    expect(customThreshold).toBeInTheDocument();
    expect(customThreshold).not.toBeDisabled();
    expect(customThreshold).toHaveValue('50');

    baseThreshold = screen.getByRole('textbox', { name: 'Threshold 2' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');

    await userEvent.click(screen.getByRole('button', { name: 'Remove threshold 1' }));

    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    baseThreshold = screen.getByRole('textbox', { name: 'Threshold 1' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');
  });

  it('can not remove the base threshold', () => {
    setup();

    const baseThreshold = screen.getByRole('textbox', { name: 'Threshold 1' });
    expect(within(baseThreshold).queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('sorts thresholds when values change', async () => {
    const thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: '#7EB26D' },
        { value: 50, color: '#EAB839' },
        { value: 75, color: '#6ED0E0' },
      ],
    };
    setup({ thresholds });

    expect(screen.getByRole('textbox', { name: 'Threshold 1' })).toHaveValue('75');
    expect(screen.getByRole('textbox', { name: 'Threshold 2' })).toHaveValue('50');

    await userEvent.clear(screen.getByRole('textbox', { name: 'Threshold 2' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Threshold 2' }), '100');

    expect(screen.getByRole('textbox', { name: 'Threshold 1' })).toHaveValue('100');
    expect(screen.getByRole('textbox', { name: 'Threshold 2' })).toHaveValue('75');
  });

  it('preserves a variable expression as a string and keeps it at the end', async () => {
    const onChange = jest.fn();
    const thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: '#7EB26D' },
        { value: 50, color: '#EAB839' },
        { value: 75, color: '#6ED0E0' },
      ],
    };
    setup({ thresholds, onChange });

    // Threshold 2 is the step with value 50
    const input = screen.getByRole('textbox', { name: 'Threshold 2' });
    await userEvent.clear(input);
    await userEvent.type(input, '$myVar');

    // variable steps sort after numeric steps, so it is rendered at the top (Threshold 1)
    expect(screen.getByRole('textbox', { name: 'Threshold 1' })).toHaveValue('$myVar');
    expect(screen.getByRole('textbox', { name: 'Threshold 2' })).toHaveValue('75');

    await userEvent.tab();

    expect(onChange).toHaveBeenCalledWith({
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: '#7EB26D' },
        { value: 75, color: '#6ED0E0' },
        { value: '$myVar', color: '#EAB839' },
      ],
    });
  });

  it('keeps numeric entry stored as numbers', async () => {
    const onChange = jest.fn();
    const thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: '#7EB26D' },
        { value: 50, color: '#EAB839' },
      ],
    };
    setup({ thresholds, onChange });

    const input = screen.getByRole('textbox', { name: 'Threshold 1' });
    await userEvent.clear(input);
    // paste to exercise the comma-to-dot conversion in one change event
    await userEvent.paste('4,2');
    await userEvent.tab();

    expect(onChange).toHaveBeenCalledWith({
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: '#7EB26D' },
        { value: 4.2, color: '#EAB839' },
      ],
    });
  });

  it('renders variable-valued steps from saved thresholds', () => {
    setup({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: '#7EB26D' },
          { value: 50, color: '#EAB839' },
          { value: '$myVar', color: '#6ED0E0' },
        ],
      },
    });

    expect(screen.getByRole('textbox', { name: 'Threshold 1' })).toHaveValue('$myVar');
    expect(screen.getByRole('textbox', { name: 'Threshold 2' })).toHaveValue('50');

    const baseThreshold = screen.getByRole('textbox', { name: 'Threshold 3' });
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');
  });

  it('adds the next threshold based on the highest numeric step, ignoring variable steps', async () => {
    setup({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: '#7EB26D' },
          { value: 50, color: '#EAB839' },
          { value: '$myVar', color: '#6ED0E0' },
        ],
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Add threshold' }));

    // new step is 50 + 10, sorted after 50 but before the variable step
    expect(screen.getByRole('textbox', { name: 'Threshold 1' })).toHaveValue('$myVar');
    expect(screen.getByRole('textbox', { name: 'Threshold 2' })).toHaveValue('60');
    expect(screen.getByRole('textbox', { name: 'Threshold 3' })).toHaveValue('50');
  });

  it('should not steal focus on mount', () => {
    setup({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: '#7EB26D' },
          { value: 50, color: '#EAB839' },
        ],
      },
    });

    expect(document.body).toHaveFocus();
  });

  it('should focus the new threshold input when user adds a threshold', async () => {
    setup({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [{ value: -Infinity, color: 'green' }],
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Add threshold' }));

    const newInput = screen.getByRole('textbox', { name: 'Threshold 1' });
    expect(newInput).toHaveFocus();
  });

  it('should not steal focus when thresholds change externally', () => {
    const { rerender } = render(
      <ThresholdsEditor
        thresholds={{ mode: ThresholdsMode.Absolute, steps: [{ value: -Infinity, color: 'green' }] }}
        onChange={jest.fn()}
      />
    );

    expect(document.body).toHaveFocus();

    rerender(
      <ThresholdsEditor
        thresholds={{
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 50, color: '#EAB839' },
            { value: 80, color: 'red' },
          ],
        }}
        onChange={jest.fn()}
      />
    );

    expect(document.body).toHaveFocus();
  });

  it('rerenders correctly when thresholds change', () => {
    const { rerender } = render(
      <ThresholdsEditor
        thresholds={{ mode: ThresholdsMode.Absolute, steps: [{ value: -Infinity, color: 'green' }] }}
        onChange={jest.fn()}
      />
    );

    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    rerender(
      <ThresholdsEditor
        thresholds={{
          mode: ThresholdsMode.Percentage,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 60, color: '#EAB839' },
            { value: 80, color: 'red' },
          ],
        }}
        onChange={jest.fn()}
      />
    );

    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(screen.getByRole('textbox', { name: 'Threshold 1' })).toHaveValue('80');
    expect(screen.getByRole('textbox', { name: 'Threshold 2' })).toHaveValue('60');
  });

  it('should exclude invalid steps and render a proper list', () => {
    setup({
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: '#7EB26D' },
          { value: 75, color: '#6ED0E0' },
          { color: '#7EB26D' } as unknown as Threshold,
          { value: 78, color: '#EAB839' },
          { value: null, color: '#7EB26D' } as unknown as Threshold,
          { value: null, color: '#7EB26D' } as unknown as Threshold,
        ],
      },
    });

    expect(screen.getByRole('textbox', { name: 'Threshold 1' })).toHaveValue('78');
    expect(screen.getByRole('textbox', { name: 'Threshold 2' })).toHaveValue('75');
    const baseThreshold = screen.getByRole('textbox', { name: 'Threshold 3' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');
  });
});
