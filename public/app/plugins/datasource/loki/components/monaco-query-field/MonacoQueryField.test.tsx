import { render, screen } from '@testing-library/react';
import React from 'react';

import LokiLanguageProvider from '../../LanguageProvider';
import { createLokiDatasource } from '../../mocks';

import MonacoQueryField from './MonacoQueryField';
import { Props } from './MonacoQueryFieldProps';

function renderComponent({ initialValue = '', onRunQuery = jest.fn(), onBlur = jest.fn() }: Partial<Props> = {}) {
  const datasource = createLokiDatasource();
  const languageProvider = new LokiLanguageProvider(datasource);

  render(
    <MonacoQueryField
      languageProvider={languageProvider}
      initialValue={initialValue}
      history={[]}
      onRunQuery={onRunQuery}
      onBlur={onBlur}
    />
  );
}

describe('MonacoQueryField', () => {
  test('Renders with no errors', async () => {
    renderComponent();

    expect(await screen.findByText('Loading...')).toBeInTheDocument();
  });
});
