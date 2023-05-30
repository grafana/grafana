import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { FileUpload } from './FileUpload';

describe('FileUpload', () => {
  it('should render upload button with default text and no file name', () => {
    render(<FileUpload onFileUpload={() => {}} />);
    expect(screen.getByText('Upload file')).toBeInTheDocument();
    expect(screen.queryByLabelText('File name')).toBeNull();
  });

  it('clicking the button should trigger the input', async () => {
    const mockInputOnClick = jest.fn();
    const { getByTestId } = render(<FileUpload onFileUpload={() => {}} />);
    const button = screen.getByText('Upload file');
    const input = getByTestId(selectors.components.FileUpload.inputField);

    // attach a click listener to the input
    input.onclick = mockInputOnClick;

    await userEvent.click(button);
    expect(mockInputOnClick).toHaveBeenCalled();
  });

  it('should display uploaded file name', async () => {
    const testFileName = 'grafana.png';
    const file = new File(['(⌐□_□)'], testFileName, { type: 'image/png' });
    const onFileUpload = jest.fn();
    const { getByTestId } = render(<FileUpload onFileUpload={onFileUpload} showFileName={true} />);
    let uploader = getByTestId(selectors.components.FileUpload.inputField);
    await waitFor(() =>
      fireEvent.change(uploader, {
        target: { files: [file] },
      })
    );
    let uploaderLabel = getByTestId(selectors.components.FileUpload.fileNameSpan);
    expect(uploaderLabel).toHaveTextContent(testFileName);
  });

  it("should trim uploaded file's name", async () => {
    const testFileName = 'longFileName.something.png';
    const file = new File(['(⌐□_□)'], testFileName, { type: 'image/png' });
    const onFileUpload = jest.fn();
    const { getByTestId } = render(<FileUpload onFileUpload={onFileUpload} showFileName={true} />);
    let uploader = getByTestId(selectors.components.FileUpload.inputField);
    await waitFor(() =>
      fireEvent.change(uploader, {
        target: { files: [file] },
      })
    );
    let uploaderLabel = getByTestId(selectors.components.FileUpload.fileNameSpan);
    expect(uploaderLabel).toHaveTextContent('longFileName.som....png');
  });
});
