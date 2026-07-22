import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FieldColorModeId } from '@grafana/data';
import { config } from '@grafana/runtime';

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
  {
    id: FieldColorModeId.PaletteCategoricalNext,
    name: 'Categorical Next',
    description: 'Experimental categorical palette',
    getCalculator: () => 'red',
  },
  {
    id: FieldColorModeId.PaletteCategoricalNext2,
    name: 'Categorical Next 2',
    description: 'Experimental categorical palette',
    getCalculator: () => 'red',
  },
  {
    id: FieldColorModeId.PaletteCategoricalNext3,
    name: 'Categorical Next 3',
    description: 'Experimental categorical palette',
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

const mockGetBooleanValue = jest.fn().mockReturnValue(false);
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: jest.fn(() => ({
    getBooleanValue: mockGetBooleanValue,
  })),
}));

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
    mockGetBooleanValue.mockReturnValue(false);
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

  describe('dataviz.experimentalColorSchemes', () => {
    it('shows the experimental categorical palette options only when the feature flag is enabled', async () => {
      mockGetBooleanValue.mockReturnValue(true);
      render(<FieldColorEditor {...defaultEditorProps} />);
      await userEvent.type(screen.getByRole('combobox'), '{arrowdown}');
      expect(screen.getByText(/^Categorical Next$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Categorical Next 2$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Categorical Next 3$/i)).toBeInTheDocument();
    });

    it('does not show the experimental categorical palette options when the feature flag is disabled', async () => {
      mockGetBooleanValue.mockReturnValue(false);
      render(<FieldColorEditor {...defaultEditorProps} />);
      await userEvent.type(screen.getByRole('combobox'), '{arrowdown}');
      expect(screen.queryByText(/^Categorical Next$/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Categorical Next 2$/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Categorical Next 3$/i)).not.toBeInTheDocument();
    });
  });
});
