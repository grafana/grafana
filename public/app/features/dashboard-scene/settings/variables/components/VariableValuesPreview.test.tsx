import { render, within } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { VariableValueOption } from '@grafana/scenes';

import { VariableValuesPreview, VariableValuesPreviewProps } from './VariableValuesPreview';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: {
      multiPropsVariables: true,
    },
  },
}));

function renderPreview(props: VariableValuesPreviewProps) {
  const renderResult = render(<VariableValuesPreview options={props.options} staticOptions={props.staticOptions} />);

  return {
    ...renderResult,
    elements: {
      multiPropsPreviewTable: () =>
        // the <InteractiveTable /> is wrapped in a div because it does not allow a data-testid attribute
        within(
          renderResult.getByTestId(selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.previewTable)
        ).getByRole('table') as HTMLTableElement,
    },
  };
}

describe('VariableValuesPreview', () => {
  describe('multiple properties preview', () => {
    test('renders the options in a table', () => {
      const options: VariableValueOption[] = [
        { label: 'Development', value: 'dev', properties: { region: 'eu' } },
        { label: 'Production', value: 'prod', properties: { region: 'us' } },
        { label: 'Staging', value: 'stag', properties: { region: 'apac' } },
      ];
      const { elements } = renderPreview({ options, staticOptions: [] });

      const table = elements.multiPropsPreviewTable();

      const expectedHeaders = ['text', 'value', 'region'];
      const headerCells = within(table).getAllByRole('columnheader');
      expect(headerCells).toHaveLength(expectedHeaders.length);
      expect(headerCells.map((cell) => cell.textContent)).toEqual(expectedHeaders);

      const expectedRows = [
        ['Development', 'dev', 'eu'],
        ['Production', 'prod', 'us'],
        ['Staging', 'stag', 'apac'],
      ];

      const rows = Array.from(table.tBodies[0].rows);
      expect(rows).toHaveLength(expectedRows.length);
      expectedRows.forEach((expectedCells, index) => {
        expect(
          within(rows[index])
            .getAllByRole('cell')
            .map((cell) => cell.textContent)
        ).toEqual(expectedCells);
      });
    });

    describe('if several options have the same value', () => {
      test('renders properly all the options in a table', () => {
        const options: VariableValueOption[] = [
          { label: 'Development', value: 'env', properties: { region: 'eu' } },
          { label: 'Production', value: 'env', properties: { region: 'us' } },
          { label: 'Staging', value: 'env', properties: { region: 'apac' } },
        ];
        const { elements } = renderPreview({ options, staticOptions: [] });

        const table = elements.multiPropsPreviewTable();

        const expectedHeaders = ['text', 'value', 'region'];
        const headerCells = within(table).getAllByRole('columnheader');
        expect(headerCells).toHaveLength(expectedHeaders.length);
        expect(headerCells.map((cell) => cell.textContent)).toEqual(expectedHeaders);

        const expectedRows = [
          ['Development', 'env', 'eu'],
          ['Production', 'env', 'us'],
          ['Staging', 'env', 'apac'],
        ];

        const rows = Array.from(table.tBodies[0].rows);
        expect(rows).toHaveLength(expectedRows.length);
        expectedRows.forEach((expectedCells, index) => {
          expect(
            within(rows[index])
              .getAllByRole('cell')
              .map((cell) => cell.textContent)
          ).toEqual(expectedCells);
        });
      });
    });
  });
});
