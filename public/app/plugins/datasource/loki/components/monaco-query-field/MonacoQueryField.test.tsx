import { render, screen } from '@testing-library/react';
import React from 'react';

import { createLokiDatasource } from '../../mocks';

import MonacoQueryField from './MonacoQueryField';
import { Props } from './MonacoQueryFieldProps';

function renderComponent({ initialValue = '', onRunQuery = jest.fn(), onBlur = jest.fn() }: Partial<Props> = {}) {
  const datasource = createLokiDatasource();

  render(
    <MonacoQueryField
      datasource={datasource}
      initialValue={initialValue}
      history={[]}
      onRunQuery={onRunQuery}
      onBlur={onBlur}
      placeholder="Enter a Loki query (run with Shift+Enter)"
    />
  );
}

describe('MonacoQueryField', () => {
  test('Renders with no errors', async () => {
    renderComponent();

    expect(await screen.findByText('Loading...')).toBeInTheDocument();
  });
});
