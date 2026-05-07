import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FieldColorModeId } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  DYNAMIC_PALETTES_INDEX_KEY,
  DYNAMIC_PALETTE_KEY_PREFIX,
  resetDynamicFieldColorModesForTests,
} from 'app/features/dynamic-palettes/dynamicPalettes';

import { FieldColorEditor } from './fieldColor';

const testRegistryItems = [
  {
    id: 'foo',
    name: 'Foo',
    description: 'This option will appear in the picker',
    getCalculator: () => 'red',
  },
  {
    id: 'bar',
    name: 'Bar',
    description: 'This option will also appear in the picker',
    getCalculator: () => 'green',
  },
  {
    id: 'baz',
    name: 'Baz',
    description: 'This option will not appear in the picker',
    getCalculator: () => 'blue',
    excludeFromPicker: true,
  },
  {
    id: FieldColorModeId.PaletteColorblind,
    name: 'Colorblind safe',
    description: 'Colorblind-safe palette option',
    getCalculator: () => 'red',
  },
];

jest.mock('@grafana/data', () => {
  const actualData = jest.requireActual('@grafana/data');
  return {
    ...actualData,
    fieldColorModeRegistry: new actualData.Registry(() => testRegistryItems),
  };
});

const defaultEditorProps = {
  value: undefined,
  onChange: () => {},
  id: 'test',
  'data-testid': 'test',
  context: { data: [] },
  item: testRegistryItems[0],
};

describe('fieldColor', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDynamicFieldColorModesForTests();
  });

  it('filters out registry options with excludeFromPicker=true', async () => {
    render(<FieldColorEditor {...defaultEditorProps} />);
    await userEvent.type(screen.getByRole('combobox'), '{arrowdown}');
    expect(screen.getByText(/^Foo/i)).toBeInTheDocument();
    expect(screen.getByText(/^Bar/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Baz/i)).not.toBeInTheDocument();
  });

  describe('enableColorblindSafePanelOptions', () => {
    let previousEnableColorblindSafePanelOptions: boolean | undefined;

    beforeEach(() => {
      previousEnableColorblindSafePanelOptions = config.featureToggles.enableColorblindSafePanelOptions;
    });

    afterEach(() => {
      config.featureToggles.enableColorblindSafePanelOptions = previousEnableColorblindSafePanelOptions;
    });

    it('shows the colorblind palette option only when the feature flag is enabled', async () => {
      config.featureToggles.enableColorblindSafePanelOptions = true;
      render(<FieldColorEditor {...defaultEditorProps} />);
      await userEvent.type(screen.getByRole('combobox'), '{arrowdown}');
      expect(screen.getByText(/^Colorblind safe/i)).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(3);
    });

    it('does not show the colorblind palette option when the feature flag is disabled', async () => {
      config.featureToggles.enableColorblindSafePanelOptions = false;
      render(<FieldColorEditor {...defaultEditorProps} />);
      await userEvent.type(screen.getByRole('combobox'), '{arrowdown}');
      expect(screen.queryByText(/^Colorblind safe/i)).not.toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(2);
    });
  });

  it('shows a palette loaded asynchronously from local storage', async () => {
    const dynamicId = `sunset-${Date.now()}`;

    localStorage.setItem(
      DYNAMIC_PALETTES_INDEX_KEY,
      JSON.stringify([{ id: dynamicId, name: 'Sunset', group: 'Custom' }])
    );
    localStorage.setItem(
      `${DYNAMIC_PALETTE_KEY_PREFIX}${dynamicId}`,
      JSON.stringify(['#FF6B6B', '#FFB36B', '#FFD56B'])
    );

    render(<FieldColorEditor {...defaultEditorProps} />);
    await userEvent.type(screen.getByRole('combobox'), '{arrowdown}');

    expect(await screen.findByText(/^Sunset/i)).toBeInTheDocument();
  });
});
