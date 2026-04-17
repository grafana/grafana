import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type JSX } from 'react';

import { FieldColorModeId } from '@grafana/data';

import { FieldColorEditor } from './fieldColor';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

// Enable the feature flag so the Gradient option is not filtered out by the flag guard.
jest.mock('@grafana/runtime', () => ({
  config: { featureToggles: { pieChartGradientColorScheme: true } },
}));

// Replace ColorValueEditor with a lightweight stub so we can assert on the
// number of color pickers rendered and the value each one receives.
jest.mock('./color', () => ({
  ColorValueEditor: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <button data-testid="color-value-editor" data-value={value ?? ''} onClick={() => onChange(value ?? '')}>
      {value ?? 'no-color'}
    </button>
  ),
}));

// Use a real-ish registry that includes Fixed, Shades, and Gradient so mode
// switching works without depending on the full registry initialisation.
jest.mock('@grafana/data', () => {
  const actualData = jest.requireActual('@grafana/data');
  return {
    ...actualData,
    fieldColorModeRegistry: new actualData.Registry(() => [
      {
        id: actualData.FieldColorModeId.Fixed,
        name: 'Single color',
        getCalculator: () => () => 'red',
      },
      {
        id: actualData.FieldColorModeId.Shades,
        name: 'Shades of a color',
        getCalculator: () => () => 'red',
      },
      {
        id: actualData.FieldColorModeId.Gradient,
        name: 'Gradient',
        getCalculator: () => () => 'red',
      },
    ]),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(jsx: JSX.Element) {
  return {
    user: userEvent.setup(),
    ...render(jsx),
  };
}

// gradientSupport must be true so the Gradient option is not filtered out of the picker.
// Tests in this file specifically cover gradient mode behaviour so this flag is always needed.
const noopItem = { settings: { gradientSupport: true } } as Parameters<typeof FieldColorEditor>[0]['item'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FieldColorEditor — gradient mode', () => {
  describe('rendering', () => {
    it('renders two color pickers when mode is gradient', () => {
      render(
        <FieldColorEditor
          value={{ mode: FieldColorModeId.Gradient, fixedColor: '#73BF69', gradientColorTo: '#F2495C' }}
          onChange={() => {}}
          id="test"
          context={{ data: [] }}
          item={noopItem}
        />
      );

      const pickers = screen.getAllByTestId('color-value-editor');
      expect(pickers).toHaveLength(2);
    });

    it('shows the start color (fixedColor) in the first picker', () => {
      render(
        <FieldColorEditor
          value={{ mode: FieldColorModeId.Gradient, fixedColor: '#aabbcc', gradientColorTo: '#F2495C' }}
          onChange={() => {}}
          id="test"
          context={{ data: [] }}
          item={noopItem}
        />
      );

      const pickers = screen.getAllByTestId('color-value-editor');
      expect(pickers[0]).toHaveAttribute('data-value', '#aabbcc');
    });

    it('shows the end color (gradientColorTo) in the second picker', () => {
      render(
        <FieldColorEditor
          value={{ mode: FieldColorModeId.Gradient, fixedColor: '#73BF69', gradientColorTo: '#ddeeff' }}
          onChange={() => {}}
          id="test"
          context={{ data: [] }}
          item={noopItem}
        />
      );

      const pickers = screen.getAllByTestId('color-value-editor');
      expect(pickers[1]).toHaveAttribute('data-value', '#ddeeff');
    });

    it('shows default start color when fixedColor is not set', () => {
      render(
        <FieldColorEditor
          value={{ mode: FieldColorModeId.Gradient }}
          onChange={() => {}}
          id="test"
          context={{ data: [] }}
          item={noopItem}
        />
      );

      const pickers = screen.getAllByTestId('color-value-editor');
      expect(pickers[0]).toHaveAttribute('data-value', '#73BF69');
    });

    it('shows default end color when gradientColorTo is not set', () => {
      render(
        <FieldColorEditor
          value={{ mode: FieldColorModeId.Gradient }}
          onChange={() => {}}
          id="test"
          context={{ data: [] }}
          item={noopItem}
        />
      );

      const pickers = screen.getAllByTestId('color-value-editor');
      expect(pickers[1]).toHaveAttribute('data-value', '#F2495C');
    });

    it('renders only one color picker for Fixed mode (no regression)', () => {
      render(
        <FieldColorEditor
          value={{ mode: FieldColorModeId.Fixed, fixedColor: '#ff0000' }}
          onChange={() => {}}
          id="test"
          context={{ data: [] }}
          item={noopItem}
        />
      );

      expect(screen.getAllByTestId('color-value-editor')).toHaveLength(1);
    });
  });

  describe('onChange behaviour when switching to gradient', () => {
    it('seeds fixedColor and gradientColorTo defaults when switching to gradient', async () => {
      const onChange = jest.fn();
      const { user } = setup(
        <FieldColorEditor
          value={{ mode: FieldColorModeId.Fixed }}
          onChange={onChange}
          id="test"
          context={{ data: [] }}
          item={noopItem}
        />
      );

      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText('Gradient'));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: FieldColorModeId.Gradient,
          fixedColor: '#73BF69',
          gradientColorTo: '#F2495C',
        })
      );
    });

    it('preserves existing fixedColor when switching to gradient', async () => {
      const onChange = jest.fn();
      const { user } = setup(
        <FieldColorEditor
          value={{ mode: FieldColorModeId.Fixed, fixedColor: '#custom1' }}
          onChange={onChange}
          id="test"
          context={{ data: [] }}
          item={noopItem}
        />
      );

      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText('Gradient'));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: FieldColorModeId.Gradient,
          fixedColor: '#custom1', // preserved — not overwritten
        })
      );
    });

    it('preserves existing gradientColorTo when switching back to gradient', async () => {
      const onChange = jest.fn();
      const { user } = setup(
        <FieldColorEditor
          value={{ mode: FieldColorModeId.Fixed, gradientColorTo: '#custom2' }}
          onChange={onChange}
          id="test"
          context={{ data: [] }}
          item={noopItem}
        />
      );

      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText('Gradient'));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          gradientColorTo: '#custom2', // preserved — not overwritten
        })
      );
    });

    it('only gradient mode triggers default seeding — switching to Fixed does not add extra fields', async () => {
      const onChange = jest.fn();
      const { user } = setup(
        <FieldColorEditor
          value={{ mode: FieldColorModeId.Gradient, fixedColor: '#73BF69', gradientColorTo: '#F2495C' }}
          onChange={onChange}
          id="test"
          context={{ data: [] }}
          item={noopItem}
        />
      );

      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText('Single color'));

      // mode is updated; no extra gradient-specific seeding happens for Fixed
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: FieldColorModeId.Fixed }));
      const call = onChange.mock.calls[0][0];
      // Verify the seeding block was NOT entered (no new defaults injected beyond spread)
      expect(call.fixedColor).toBe('#73BF69'); // preserved from previous value via spread
      expect(call.gradientColorTo).toBe('#F2495C'); // preserved from previous value via spread
    });
  });
});
