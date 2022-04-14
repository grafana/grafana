import { render, screen } from '@testing-library/react';
import React from 'react';

import { AddBackupModal } from './AddBackupModal';

jest.mock('./AddBackupModal.service');

jest.mock('app/percona/shared/components/Form/SelectField', () => ({
  SelectField: jest.fn(() => <div data-testid="select-field" />),
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  AsyncSelect: jest.fn(() => <div data-testid="async-select" />),
}));

describe('AddBackupModal', () => {
  it('should render fields', () => {
    render(<AddBackupModal isVisible backup={null} onClose={jest.fn()} onBackup={jest.fn()} />);

    expect(screen.getAllByTestId('async-select')).toHaveLength(2);
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes.filter((textbox) => textbox.tagName === 'INPUT')).toHaveLength(2);
    expect(textboxes.filter((textbox) => textbox.tagName === 'TEXTAREA')).toHaveLength(1);
    expect(screen.queryByTestId('advanced-backup-fields')).not.toBeInTheDocument();
    expect(screen.queryByTestId('retry-mode-selector')).toBeInTheDocument();
    expect(screen.queryAllByText('Incremental')).toHaveLength(0);
    expect(screen.queryAllByText('Full')).toHaveLength(0);
  });

  it('should render advanced fields when in schedule mode', () => {
    render(<AddBackupModal isVisible scheduleMode backup={null} onClose={jest.fn()} onBackup={jest.fn()} />);

    expect(screen.getByTestId('advanced-backup-fields')).toBeInTheDocument();
    expect(screen.getByTestId('select-field')).toBeInTheDocument();
    expect(screen.getByTestId('multi-select-field-div-wrapper').children).not.toHaveLength(0);
    expect(screen.queryByTestId('retry-mode-selector')).toBeInTheDocument();
  });

  it('should render backup mode selector when in schedule mode', () => {
    render(<AddBackupModal isVisible scheduleMode backup={null} onClose={jest.fn()} onBackup={jest.fn()} />);
    expect(screen.queryByText('Incremental')).toBeInTheDocument();
    expect(screen.queryByText('Full')).toBeInTheDocument();
  });
});
