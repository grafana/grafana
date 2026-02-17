import { fireEvent, render, within } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { CustomVariable } from '@grafana/scenes';

import { ModalEditor } from './ModalEditor';

jest.mock('@grafana/runtime', () => {
  const actualRuntime = jest.requireActual('@grafana/runtime');
  return {
    ...actualRuntime,
    config: {
      featureToggles: {
        multiPropsVariables: true,
      },
    },
  };
});

function buildCustomVariable(options: Partial<ConstructorParameters<typeof CustomVariable>[0]> = {}) {
  return {
    variable: new CustomVariable({
      name: 'customTestVar',
      ...options,
    }),
    onClose: jest.fn(),
  };
}

function renderModal(props: React.ComponentProps<typeof ModalEditor>) {
  const renderResult = render(<ModalEditor {...props} />);

  const elements = {
    textarea: () =>
      renderResult.getByTestId(
        selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.customValueInput
      ) as HTMLTextAreaElement,
    nonMultiPropsPreviewLabels: () =>
      renderResult.getAllByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption),
    multiPropsPreviewTable: () =>
      // the <InteractiveTable /> is wrapped in a div because it does not allow a data-testid attribute
      within(
        renderResult.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.previewTable)
      ).getByRole('table') as HTMLTableElement,
  };

  return {
    ...renderResult,
    elements,
    actions: {
      updateTextArea(newQuery: string) {
        fireEvent.change(elements.textarea(), { target: { value: newQuery } });
      },
      changeValuesFormat(format: 'CSV' | 'JSON') {
        fireEvent.click(renderResult.getByLabelText(format));
      },
    },
  };
}

describe('ModalEditor', () => {
  describe('Values preview', () => {
    it('shows CSV draft values when the textarea changes', () => {
      const { variable, onClose } = buildCustomVariable({ valuesFormat: 'csv', query: '' });
      const { actions, elements } = renderModal({ variable, onClose });

      actions.updateTextArea('alpha, beta');

      const labels = elements.nonMultiPropsPreviewLabels();

      expect(labels).toHaveLength(2);
      expect(labels[0]).toHaveTextContent('alpha');
      expect(labels[1]).toHaveTextContent('beta');
    });

    it('shows JSON draft options when the textarea changes', () => {
      const { variable, onClose } = buildCustomVariable({ valuesFormat: 'json', query: '' });
      const { actions, elements } = renderModal({ variable, onClose });

      actions.updateTextArea(
        '[{"value":"dev","text":"Development","region":"eu"},{"value":"prod","text":"Production","region":"us"}]'
      );

      const table = elements.multiPropsPreviewTable();

      const headerCells = within(table).getAllByRole('columnheader');
      expect(headerCells.map((cell) => cell.textContent)).toEqual(['text', 'value', 'region']);

      const rows = Array.from(table.tBodies[0].rows);
      const firstDataRowCells = within(rows[0]).getAllByRole('cell');
      expect(firstDataRowCells.map((cell) => cell.textContent)).toEqual(['Development', 'dev', 'eu']);

      const secondDataRowCells = within(rows[1]).getAllByRole('cell');
      expect(secondDataRowCells.map((cell) => cell.textContent)).toEqual(['Production', 'prod', 'us']);
    });
  });
});
