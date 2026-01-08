import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { FieldType, TypedVariableModel } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { rangeMatcherEditor } from './RangeMatcherEditor';

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(),
}));

describe('RangeMatcherEditor', () => {
  it('shows variable suggestions for both from and to inputs', async () => {
    // Mock template service variables
    const mockVariables: TypedVariableModel[] = [
      { name: 'var1', label: 'Variable 1', type: 'custom' } as TypedVariableModel,
      { name: 'var2', label: 'Variable 2', type: 'custom' } as TypedVariableModel,
    ];

    const mockTemplateSrv = {
      getVariables: () => mockVariables,
      replace: jest.fn(),
      containsTemplate: jest.fn(),
      updateTimeRange: jest.fn(),
    };

    jest.mocked(getTemplateSrv).mockReturnValue(mockTemplateSrv);

    const onChangeMock = jest.fn();
    const options = { from: '', to: '' };
    const field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: [],
    };

    const Editor = rangeMatcherEditor({ validator: () => true });
    render(<Editor options={options} onChange={onChangeMock} field={field} />);

    // Test "from" input
    const fromInput = screen.getByPlaceholderText('From');
    fireEvent.focus(fromInput);
    fireEvent.keyDown(fromInput, { key: '$' });

    // Wait for suggestions to appear and verify for "from" input
    await waitFor(() => {
      const menus = screen.getAllByRole('menu');
      const fromMenu = menus[0]; // First menu is for the "from" input
      const fromSuggestions = fromMenu.querySelectorAll('[role="menuitem"]');
      // Verify exact number of suggestions for "from" input
      expect(fromSuggestions).toHaveLength(mockVariables.length);

      mockVariables.forEach((variable) => {
        const suggestion = Array.from(fromSuggestions).find((s) => s.textContent?.includes(variable.label as string));
        expect(suggestion).toBeInTheDocument();
      });
    });

    // Clear suggestions
    fireEvent.blur(fromInput);

    // Test "to" input
    const toInput = screen.getByPlaceholderText('To');
    fireEvent.focus(toInput);
    fireEvent.keyDown(toInput, { key: '$' });

    // Wait for suggestions to appear and verify for "to" input
    await waitFor(() => {
      const menus = screen.getAllByRole('menu');
      const toMenu = menus[1];
      const toSuggestions = toMenu.querySelectorAll('[role="menuitem"]');
      // Verify exact number of suggestions for "to" input
      expect(toSuggestions).toHaveLength(mockVariables.length);

      mockVariables.forEach((variable) => {
        const suggestion = Array.from(toSuggestions).find((s) => s.textContent?.includes(variable.label as string));
        expect(suggestion).toBeInTheDocument();
      });
    });
  });
});
