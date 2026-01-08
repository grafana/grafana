import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { FieldType, TypedVariableModel } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { basicMatcherEditor } from './BasicMatcherEditor';

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(),
}));

describe('BasicMatcherEditor', () => {
  it('shows variable suggestions', async () => {
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
    const options = { value: '' };
    const field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: [],
    };

    const Editor = basicMatcherEditor({ validator: () => true });
    render(<Editor options={options} onChange={onChangeMock} field={field} />);

    // Focus the input and press $ to trigger suggestions
    const input = screen.getByPlaceholderText('Value or variable');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: '$' });

    // Wait for suggestions to appear and verify
    await waitFor(() => {
      const suggestions = screen.getAllByRole('menuitem');
      // Verify exact number of suggestions
      expect(suggestions).toHaveLength(mockVariables.length);

      mockVariables.forEach((variable) => {
        const suggestion = suggestions.find((s) => s.textContent?.includes(variable.label as string));
        expect(suggestion).toBeInTheDocument();
      });
    });
  });
});
