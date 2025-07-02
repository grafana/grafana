import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { createLokiDatasource } from '../../mocks/datasource';

import MonacoQueryField from './MonacoQueryField';
import { Props } from './MonacoQueryFieldProps';

function renderComponent({
  initialValue = '',
  onRunQuery = jest.fn(),
  onBlur = jest.fn(),
  onChange = jest.fn(),
}: Partial<Props> = {}) {
  const datasource = createLokiDatasource();

  render(
    <MonacoQueryField
      datasource={datasource}
      initialValue={initialValue}
      history={[]}
      onRunQuery={onRunQuery}
      onBlur={onBlur}
      onChange={onChange}
      placeholder="Enter a Loki query (run with Shift+Enter)"
    />
  );
}

describe('MonacoQueryField', () => {
  test('Renders with no errors', async () => {
    renderComponent();

    const monacoEditor = await screen.findByTestId(selectors.components.ReactMonacoEditor.editorLazy);
    expect(monacoEditor).toBeInTheDocument();
  });
});
