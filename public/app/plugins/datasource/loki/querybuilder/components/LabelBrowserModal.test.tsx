import { render, screen } from '@testing-library/react';
import React from 'react';

import { createLokiDatasource } from '../../mocks';
import { LokiQuery } from '../../types';

import { LabelBrowserModal, Props } from './LabelBrowserModal';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const lokiDatasource = createLokiDatasource();

const defaultProps: Props = {
  isOpen: true,
  languageProvider: lokiDatasource.languageProvider,
  query: {} as LokiQuery,
  onClose: jest.fn(),
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
};

describe('LabelBrowserModal', () => {
  it('passes...', () => {
    render(<LabelBrowserModal {...defaultProps} />);
    expect(screen.getByRole('heading', { name: /label browser/i })).toBeInTheDocument();
  });
});
