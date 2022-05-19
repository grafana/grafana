import { render, screen } from '@testing-library/react';
import React from 'react';

import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing by default or when isOpen is false', () => {
    render(<Modal title="Some Title" />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders correct contents', () => {
    render(
      <Modal title="Some Title" isOpen>
        <div data-testid="modal-content">Content</div>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Some Title')).toBeInTheDocument();

    expect(screen.getByTestId('modal-content')).toBeInTheDocument();
  });
});
