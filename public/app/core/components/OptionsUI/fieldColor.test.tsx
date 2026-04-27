import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FieldColorModeId } from '@grafana/data/types';
import { Registry } from '@grafana/data/utils';
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
];

jest.mock('@grafana/data/field', () => {
  const actualData = jest.requireActual('@grafana/data/field');
  return {
    ...actualData,
    fieldColorModeRegistry: new Registry(() => testRegistryItems),
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
});
