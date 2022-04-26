import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { FileUpload } from './FileUpload';

describe('FileUpload', () => {
  it('should render upload button with default text and no file name', () => {
    render(<FileUpload onFileUpload={() => {}} />);
    expect(screen.getByRole('button', { name: 'Upload file' })).toBeInTheDocument();
    expect(screen.queryByLabelText('File name')).not.toBeInTheDocument();
  });

  it("should trim uploaded file's name", async () => {
    render(<FileUpload onFileUpload={() => {}} />);

    const mockFile: File = new File(['(⌐□_□)'], 'longFileName.something.png', { type: 'image/png' });

    const fileUploadInput = screen.getByTestId('fileUpload');
    fireEvent.change(fileUploadInput, { target: { files: [mockFile] } });

    expect(screen.getByLabelText('File name')).toBeInTheDocument();
    expect(screen.getByLabelText('File name').textContent).toEqual('longFileName.som....png');
  });
});
