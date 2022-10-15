import { render, screen } from '@testing-library/react';
import React from 'react';

import LokiLanguageProvider from '../../LanguageProvider';
import { createLokiDatasource } from '../../mocks';

import { MonacoQueryFieldWrapper, Props } from './MonacoQueryFieldWrapper';

function renderComponent({
  initialValue = '',
  onChange = jest.fn(),
  onRunQuery = jest.fn(),
  runQueryOnBlur = false,
}: Partial<Props> = {}) {
  const datasource = createLokiDatasource();
  const languageProvider = new LokiLanguageProvider(datasource);

  render(
    <MonacoQueryFieldWrapper
      languageProvider={languageProvider}
      history={[]}
      initialValue={initialValue}
      onChange={onChange}
      onRunQuery={onRunQuery}
      runQueryOnBlur={runQueryOnBlur}
    />
  );
}

describe('MonacoFieldWrapper', () => {
  test('Renders with no errors', async () => {
    renderComponent();

    expect(await screen.findByText('Loading...')).toBeInTheDocument();
  });
});
