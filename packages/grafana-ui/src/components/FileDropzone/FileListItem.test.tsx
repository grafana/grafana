import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FileListItem } from './FileListItem';

const file: any = {
  name: 'someFile.jpg',
  size: 1680206,
  lastModified: 1604849095696,
  type: 'image/jpeg',
};

describe('The FileListItem component', () => {
  it('should show an error message when error prop is not null', () => {
    render(<FileListItem file={{ file, id: '1', error: new DOMException('error') }} />);

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.queryByLabelText('Retry')).not.toBeInTheDocument();
  });

  it('should show a retry icon when error is not null and retryUpload prop is passed', () => {
    const retryUpload = jest.fn();
    render(<FileListItem file={{ file, id: '1', error: new DOMException('error'), retryUpload }} />);

    fireEvent.click(screen.getByLabelText('Retry'));

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByLabelText('Retry'));
    expect(retryUpload).toBeCalledTimes(1);
  });

  it('should show a progressbar when the progress prop has a value', () => {
    render(<FileListItem file={{ file, id: '1', error: null, progress: 800000 }} />);

    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    expect(screen.getByText('48%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should not show a progressbar when progress is equal to the size', () => {
    render(<FileListItem file={{ file, id: '1', error: null, progress: 1680206 }} />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('should show a Cancel button when abortUpload prop is passed', () => {
    const abortUpload = jest.fn();
    render(<FileListItem file={{ file, id: '1', error: null, progress: 800000, abortUpload }} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(abortUpload).toBeCalledTimes(1);
  });

  it('should show a Remove icon when removeFile prop is passed', () => {
    const removeFile = jest.fn();
    const customFile = { file, id: '1', error: null };
    render(<FileListItem file={customFile} removeFile={removeFile} />);

    fireEvent.click(screen.getByLabelText('Remove'));

    expect(removeFile).toBeCalledWith(customFile);
  });
});
