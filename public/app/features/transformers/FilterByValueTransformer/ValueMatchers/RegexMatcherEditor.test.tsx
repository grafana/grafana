import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { FieldType, TypedVariableModel } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { regexMatcherEditor } from './RegexMatcherEditor';

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(),
}));

describe('RegexMatcherEditor', () => {
  it('adds :regex suffix to variable suggestions', async () => {
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

    const Editor = regexMatcherEditor({ validator: () => true });
    render(<Editor options={options} onChange={onChangeMock} field={field} />);

    // Focus the input and press $ to trigger suggestions
    const input = screen.getByPlaceholderText('Value or variable');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: '$' });

    // Wait for suggestions to appear and verify
    await waitFor(() => {
      const suggestions = screen.getAllByRole('menuitem');
      // Verify exact number of suggestions (each variable has both regular and regex versions)
      expect(suggestions).toHaveLength(mockVariables.length * 2);

      mockVariables.forEach((variable) => {
        const regularSuggestion = suggestions.find((s) => s.textContent?.includes(variable.label as string));
        const regexSuggestion = suggestions.find((s) => s.textContent?.includes(`${variable.label as string}:regex`));

        expect(regularSuggestion).toBeInTheDocument();
        expect(regexSuggestion).toBeInTheDocument();
      });
    });
  });
});
