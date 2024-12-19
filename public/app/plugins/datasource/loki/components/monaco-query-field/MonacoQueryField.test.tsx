import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { createLokiDatasource } from '../../__mocks__/datasource';

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
    const user = userEvent.setup();
    const monacoEditor = await screen.findByTestId(selectors.components.ReactMonacoEditor.editorLazy);
    expect(monacoEditor).toBeInTheDocument();

    const editor = await screen.findByLabelText(/editor content/i);
    await user.type(editor, '1');
  });
});
