import { render, fireEvent } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { CustomVariable } from '@grafana/scenes';

import { CustomVariableEditor } from './CustomVariableEditor';

function setup(options: Partial<ConstructorParameters<typeof CustomVariable>[0]> = {}) {
  return {
    variable: new CustomVariable({
      name: 'customVar',
      ...options,
    }),
    onRunQuery: jest.fn(),
  };
}

function renderEditor(ui: React.ReactNode) {
  const renderResult = render(ui);

  const elements = {
    formatButton: (label: string) => renderResult.queryByLabelText(label) as HTMLElement,
    queryInput: () =>
      renderResult.queryByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput
      ) as HTMLTextAreaElement,
    multiValueCheckbox: () =>
      renderResult.queryByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch
      ) as HTMLInputElement,
    allowCustomValueCheckbox: () =>
      renderResult.queryByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch
      ) as HTMLInputElement,
    includeAllCheckbox: () =>
      renderResult.queryByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch
      ) as HTMLInputElement,
    customAllValueInput: () =>
      renderResult.queryByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput
      ) as HTMLInputElement,
  };

  return {
    ...renderResult,
    elements,
    actions: {
      updateValuesInput(newQuery: string) {
        fireEvent.change(elements.queryInput(), { target: { value: newQuery } });
        fireEvent.blur(elements.queryInput());
      },
      changeValuesFormat(newFormat: 'csv' | 'json') {
        const targetLabel = newFormat === 'json' ? 'JSON' : 'CSV';

        const formatButton = elements.formatButton(targetLabel);
        if (formatButton === null) {
          throw new Error(`Unable to fire a "click" event - button with label "${targetLabel}" not found in DOM`);
        }

        fireEvent.click(formatButton);
      },
    },
  };
}

describe('CustomVariableEditor with multiPropsVariables toggle enabled', () => {
  beforeAll(() => {
    config.featureToggles.multiPropsVariables = true;
  });
  describe('CSV values format', () => {
    it('should render CustomVariableForm with the correct initial values', () => {
      const { variable, onRunQuery } = setup({
        query: 'test, test2',
        value: 'test',
        isMulti: true,
        includeAll: true,
        allowCustomValue: true,
        allValue: 'all',
      });

      const { elements } = renderEditor(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

      expect(elements.queryInput().value).toBe('test, test2');
      expect(elements.multiValueCheckbox().checked).toBe(true);
      expect(elements.allowCustomValueCheckbox().checked).toBe(true);
      expect(elements.includeAllCheckbox().checked).toBe(true);
      expect(elements.customAllValueInput().value).toBe('all');
    });

    it('should update the variable state when some input values change ("Multi-value", "Allow custom values" & "Include All option")', () => {
      const { variable, onRunQuery } = setup({
        query: 'test, test2',
        value: 'test',
        isMulti: false,
        allowCustomValue: false,
        includeAll: false,
      });

      const { elements } = renderEditor(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

      expect(elements.multiValueCheckbox().checked).toBe(false);
      expect(elements.allowCustomValueCheckbox().checked).toBe(false);
      expect(elements.includeAllCheckbox().checked).toBe(false);
      // include-all-custom input appears after include-all checkbox is checked only
      expect(elements.customAllValueInput()).not.toBeInTheDocument();

      fireEvent.click(elements.multiValueCheckbox());
      fireEvent.click(elements.allowCustomValueCheckbox());
      fireEvent.click(elements.includeAllCheckbox());

      expect(variable.state.isMulti).toBe(true);
      expect(variable.state.allowCustomValue).toBe(true);
      expect(variable.state.includeAll).toBe(true);
      expect(elements.customAllValueInput()).toBeInTheDocument();
    });

    describe('when the values textarea loses focus after its value has changed', () => {
      it('should update the query in the variable state and call the onRunQuery callback', async () => {
        const { variable, onRunQuery } = setup({ query: 'test, test2', value: 'test' });

        const { actions } = renderEditor(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

        actions.updateValuesInput('test3, test4');

        expect(variable.state.query).toBe('test3, test4');
        expect(onRunQuery).toHaveBeenCalled();
      });
    });

    describe('when the "Custom all value" input loses focus after its value has changed', () => {
      it('should update the variable state', () => {
        const { variable, onRunQuery } = setup({
          query: 'test, test2',
          value: 'test',
          isMulti: true,
          includeAll: true,
        });

        const { elements } = renderEditor(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

        fireEvent.change(elements.customAllValueInput(), { target: { value: 'new custom all' } });
        fireEvent.blur(elements.customAllValueInput());

        expect(variable.state.allValue).toBe('new custom all');
      });
    });
  });

  describe('JSON values format', () => {
    const initialJsonQuery = `[
      {"value":1,"text":"Development","aws":"dev","azure":"development"},
      {"value":2,"text":"Production","aws":"prod","azure":"production"}
    ]`;

    it('should render CustomVariableForm with the correct initial values', () => {
      const { variable, onRunQuery } = setup({
        valuesFormat: 'json',
        query: initialJsonQuery,
        isMulti: true,
        includeAll: true,
      });

      const { elements } = renderEditor(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

      expect(elements.queryInput().value).toBe(initialJsonQuery);
      expect(elements.multiValueCheckbox().checked).toBe(true);
      expect(elements.allowCustomValueCheckbox()).not.toBeInTheDocument();
      expect(elements.includeAllCheckbox().checked).toBe(true);
      expect(elements.customAllValueInput()).not.toBeInTheDocument();
    });

    describe('when the values textarea loses focus after its value has changed', () => {
      describe('if the value is valid JSON', () => {
        it('should update the query in the variable state and call the onRunQuery callback', async () => {
          const { variable, onRunQuery } = setup({ valuesFormat: 'json', query: initialJsonQuery });

          const { actions } = renderEditor(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

          actions.updateValuesInput('[]');

          expect(variable.state.query).toBe('[]');
          expect(onRunQuery).toHaveBeenCalled();
        });
      });

      describe('if the value is NOT valid JSON', () => {
        it('should display a validation error message and neither update the query in the variable state nor call the onRunQuery callback', async () => {
          const { variable, onRunQuery } = setup({ valuesFormat: 'json', query: initialJsonQuery });

          const { actions, getByRole } = renderEditor(
            <CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />
          );

          actions.updateValuesInput('[x]');

          expect(getByRole('alert')).toHaveTextContent(`Unexpected token 'x', "[x]" is not valid JSON`);
          expect(variable.state.query).toBe(initialJsonQuery);
          expect(onRunQuery).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('when switching values format', () => {
    it('should switch the visibility of the proper form inputs ("Allow custom values" and "Custom all value")', () => {
      const { variable, onRunQuery } = setup({
        valuesFormat: 'csv',
        query: '',
        isMulti: true,
        includeAll: true,
        allowCustomValue: true,
        allValue: '',
      });

      const { elements, actions } = renderEditor(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

      expect(elements.allowCustomValueCheckbox()).toBeInTheDocument();
      expect(elements.customAllValueInput()).toBeInTheDocument();

      actions.changeValuesFormat('json');

      expect(elements.allowCustomValueCheckbox()).not.toBeInTheDocument();
      expect(elements.customAllValueInput()).not.toBeInTheDocument();

      actions.changeValuesFormat('csv');

      expect(elements.allowCustomValueCheckbox()).toBeInTheDocument();
      expect(elements.customAllValueInput()).toBeInTheDocument();
    });
  });
});

describe('CustomVariableEditor with feature toggle disabled', () => {
  beforeAll(() => {
    config.featureToggles.multiPropsVariables = false;
  });
  it('should render CustomVariableForm with the correct initial values', () => {
    const { variable, onRunQuery } = setup({
      query: 'test, test2',
      value: 'test',
      isMulti: true,
      includeAll: true,
      allowCustomValue: true,
      allValue: 'all',
    });

    const { elements } = renderEditor(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

    expect(elements.queryInput().value).toBe('test, test2');
    expect(elements.multiValueCheckbox().checked).toBe(true);
    expect(elements.allowCustomValueCheckbox().checked).toBe(true);
    expect(elements.includeAllCheckbox().checked).toBe(true);
    expect(elements.customAllValueInput().value).toBe('all');
  });

  it('should update the variable state when some input values change ("Multi-value", "Allow custom values" & "Include All option")', () => {
    const { variable, onRunQuery } = setup({
      query: 'test, test2',
      value: 'test',
      isMulti: false,
      allowCustomValue: false,
      includeAll: false,
    });

    const { elements } = renderEditor(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

    expect(elements.multiValueCheckbox().checked).toBe(false);
    expect(elements.allowCustomValueCheckbox().checked).toBe(false);
    expect(elements.includeAllCheckbox().checked).toBe(false);
    // include-all-custom input appears after include-all checkbox is checked only
    expect(elements.customAllValueInput()).not.toBeInTheDocument();

    fireEvent.click(elements.multiValueCheckbox());
    fireEvent.click(elements.allowCustomValueCheckbox());
    fireEvent.click(elements.includeAllCheckbox());

    expect(variable.state.isMulti).toBe(true);
    expect(variable.state.allowCustomValue).toBe(true);
    expect(variable.state.includeAll).toBe(true);
    expect(elements.customAllValueInput()).toBeInTheDocument();
  });

  describe('when the values textarea loses focus after its value has changed', () => {
    it('should update the query in the variable state and call the onRunQuery callback', async () => {
      const { variable, onRunQuery } = setup({ query: 'test, test2', value: 'test' });

      const { actions } = renderEditor(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

      actions.updateValuesInput('test3, test4');

      expect(variable.state.query).toBe('test3, test4');
      expect(onRunQuery).toHaveBeenCalled();
    });
  });

  describe('when the "Custom all value" input loses focus after its value has changed', () => {
    it('should update the variable state', () => {
      const { variable, onRunQuery } = setup({
        query: 'test, test2',
        value: 'test',
        isMulti: true,
        includeAll: true,
      });

      const { elements } = renderEditor(<CustomVariableEditor variable={variable} onRunQuery={onRunQuery} />);

      fireEvent.change(elements.customAllValueInput(), { target: { value: 'new custom all' } });
      fireEvent.blur(elements.customAllValueInput());

      expect(variable.state.allValue).toBe('new custom all');
    });
  });
});
