import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, Threshold, ThresholdsMode } from '@grafana/data';
import { mockThemeContext } from '@grafana/ui';

import { ThresholdsEditor, Props } from './ThresholdsEditor';

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

    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);

    let baseThreshold = screen.getByRole('textbox', { name: 'Threshold 1' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');

    await userEvent.click(screen.getByRole('button', { name: 'Add threshold' }));

    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);

    let customThreshold = screen.getByRole('spinbutton', { name: 'Threshold 1' });
    expect(customThreshold).toBeInTheDocument();
    expect(customThreshold).not.toBeDisabled();
    expect(customThreshold).toHaveValue(0);

    baseThreshold = screen.getByRole('textbox', { name: 'Threshold 2' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');

    await userEvent.click(screen.getByRole('button', { name: 'Add threshold' }));

    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);

    let customThreshold2 = screen.getByRole('spinbutton', { name: 'Threshold 1' });
    expect(customThreshold2).toBeInTheDocument();
    expect(customThreshold2).not.toBeDisabled();
    expect(customThreshold2).toHaveValue(10);

    customThreshold = screen.getByRole('spinbutton', { name: 'Threshold 2' });
    expect(customThreshold).toBeInTheDocument();
    expect(customThreshold).not.toBeDisabled();
    expect(customThreshold).toHaveValue(0);

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

    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);

    let customThreshold2 = screen.getByRole('spinbutton', { name: 'Threshold 1' });
    expect(customThreshold2).toBeInTheDocument();
    expect(customThreshold2).not.toBeDisabled();
    expect(customThreshold2).toHaveValue(75);

    let customThreshold = screen.getByRole('spinbutton', { name: 'Threshold 2' });
    expect(customThreshold).toBeInTheDocument();
    expect(customThreshold).not.toBeDisabled();
    expect(customThreshold).toHaveValue(50);

    let baseThreshold = screen.getByRole('textbox', { name: 'Threshold 3' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');

    await userEvent.click(screen.getByRole('button', { name: 'Remove threshold 1' }));

    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);

    customThreshold = screen.getByRole('spinbutton', { name: 'Threshold 1' });
    expect(customThreshold).toBeInTheDocument();
    expect(customThreshold).not.toBeDisabled();
    expect(customThreshold).toHaveValue(50);

    baseThreshold = screen.getByRole('textbox', { name: 'Threshold 2' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');

    await userEvent.click(screen.getByRole('button', { name: 'Remove threshold 1' }));

    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);

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

    expect(screen.getByRole('spinbutton', { name: 'Threshold 1' })).toHaveValue(75);
    expect(screen.getByRole('spinbutton', { name: 'Threshold 2' })).toHaveValue(50);

    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Threshold 2' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Threshold 2' }), '100');

    expect(screen.getByRole('spinbutton', { name: 'Threshold 1' })).toHaveValue(100);
    expect(screen.getByRole('spinbutton', { name: 'Threshold 2' })).toHaveValue(75);
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

    expect(screen.getByRole('spinbutton', { name: 'Threshold 1' })).toHaveValue(78);
    expect(screen.getByRole('spinbutton', { name: 'Threshold 2' })).toHaveValue(75);
    const baseThreshold = screen.getByRole('textbox', { name: 'Threshold 3' });
    expect(baseThreshold).toBeInTheDocument();
    expect(baseThreshold).toBeDisabled();
    expect(baseThreshold).toHaveValue('Base');
  });
});
