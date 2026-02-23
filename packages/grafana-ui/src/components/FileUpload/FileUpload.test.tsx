import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors } from '@grafana/e2e-selectors';

import { FileUpload } from './FileUpload';

describe('FileUpload', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup({ applyAccept: false });
  });

  it('should render upload button with default text and no file name', () => {
    render(<FileUpload onFileUpload={() => {}} />);
    expect(screen.getByText('Upload file')).toBeInTheDocument();
    expect(screen.queryByLabelText('File name')).not.toBeInTheDocument();
  });

  it('clicking the button should trigger the input', async () => {
    const mockInputOnClick = jest.fn();
    render(<FileUpload onFileUpload={() => {}} />);
    const button = screen.getByText('Upload file');
    const input = screen.getByTestId(selectors.components.FileUpload.inputField);

    // attach a click listener to the input
    input.onclick = mockInputOnClick;

    await userEvent.click(button);
    expect(mockInputOnClick).toHaveBeenCalled();
  });

  it('should display uploaded file name', async () => {
    const testFileName = 'grafana.png';
    const file = new File(['(⌐□_□)'], testFileName, { type: 'image/png' });
    const onFileUpload = jest.fn();
    render(<FileUpload onFileUpload={onFileUpload} showFileName={true} />);
    const uploader = await screen.findByTestId(selectors.components.FileUpload.inputField);
    await user.upload(uploader, file);
    const uploaderLabel = await screen.findByTestId(selectors.components.FileUpload.fileNameSpan);
    expect(uploaderLabel).toHaveTextContent(testFileName);
  });

  it("should trim uploaded file's name", async () => {
    const testFileName = 'longFileName.something.png';
    const file = new File(['(⌐□_□)'], testFileName, { type: 'image/png' });
    const onFileUpload = jest.fn();
    render(<FileUpload onFileUpload={onFileUpload} showFileName={true} />);
    const uploader = screen.getByTestId(selectors.components.FileUpload.inputField);
    await user.upload(uploader, file);
    const uploaderLabel = screen.getByTestId(selectors.components.FileUpload.fileNameSpan);
    expect(uploaderLabel).toHaveTextContent('longFileName.som....png');
  });
});
