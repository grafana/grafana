import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { FieldType } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

import { regexMatcherEditor } from './RegexMatcherEditor';

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(),
}));

describe('RegexMatcherEditor', () => {
  it('adds :regex suffix to variable suggestions', async () => {
    // Mock template service variables
    const mockVariables = [
      { name: 'var1', label: 'Variable 1', value: '$var1' },
      { name: 'var2', label: 'Variable 2', value: '$var2' },
    ];

    (getTemplateSrv as jest.Mock).mockReturnValue({
      getVariables: () => mockVariables,
    });

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
      mockVariables.forEach((variable) => {
        const regularSuggestion = suggestions.find((s) => s.textContent?.includes(variable.label));
        const regexSuggestion = suggestions.find((s) => s.textContent?.includes(`${variable.label}:regex`));

        expect(regularSuggestion).toBeInTheDocument();
        expect(regexSuggestion).toBeInTheDocument();
      });
    });
  });
});
