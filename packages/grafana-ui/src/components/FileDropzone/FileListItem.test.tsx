import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { FileListItem, REMOVE_FILE } from './FileListItem';

const file = ({
  fileBits = 'prettyPicture',
  fileName = 'someFile.jpg',
  options = { lastModified: 1604849095696, type: 'image/jpeg' },
}) => new File([fileBits], fileName, options);

describe('The FileListItem component', () => {
  it('should show an error message when error prop is not null', () => {
    render(<FileListItem file={{ file: file({}), id: '1', error: new DOMException('error') }} />);

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.queryByLabelText('Retry')).not.toBeInTheDocument();
  });

  it('should show a retry icon when error is not null and retryUpload prop is passed', () => {
    const retryUpload = jest.fn();
    render(<FileListItem file={{ file: file({}), id: '1', error: new DOMException('error'), retryUpload }} />);

    fireEvent.click(screen.getByLabelText('Retry'));

    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByLabelText('Retry'));
    expect(retryUpload).toBeCalledTimes(1);
  });

  it('should show a progressbar when the progress prop has a value', () => {
    render(<FileListItem file={{ file: file({}), id: '1', error: null, progress: 6 }} />);

    expect(screen.queryByText('Cancel upload')).not.toBeInTheDocument();
    expect(screen.getByText('46%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should not show a progressbar when progress is equal to the size', () => {
    render(<FileListItem file={{ file: file({}), id: '1', error: null, progress: 13 }} />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('should show a Cancel button when abortUpload prop is passed', () => {
    const abortUpload = jest.fn();
    render(<FileListItem file={{ file: file({}), id: '1', error: null, progress: 6, abortUpload }} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(abortUpload).toBeCalledTimes(1);
  });

  it('should show a Remove icon when removeFile prop is passed', () => {
    const removeFile = jest.fn();
    const customFile = { file: file({}), id: '1', error: null };
    render(<FileListItem file={customFile} removeFile={removeFile} />);

    fireEvent.click(screen.getByRole('button', { name: REMOVE_FILE }));

    expect(removeFile).toBeCalledWith(customFile);
  });
});
