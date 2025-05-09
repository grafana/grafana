import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FileDropzone } from './FileDropzone';
import { REMOVE_FILE } from './FileListItem';

const file = ({
  fileBits = JSON.stringify({ ping: true }),
  fileName = 'ping.json',
  options = { type: 'application/json' },
}) => new File([fileBits], fileName, options);

const files = [
  file({}),
  file({ fileName: 'pong.json' }),
  file({ fileBits: 'something', fileName: 'something.jpg', options: { type: 'image/jpeg' } }),
];

describe('The FileDropzone component', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should show the default text of the dropzone component when no props passed', () => {
    render(<FileDropzone />);

    expect(screen.getByText('Upload file')).toBeInTheDocument();
  });

  it('should show the accepted file type(s) when passed in as a string', () => {
    render(<FileDropzone options={{ accept: '.json' }} />);

    expect(screen.getByText('Accepted file type: .json')).toBeInTheDocument();
  });

  it('should show an error message when the file size exceeds the max file size', async () => {
    render(<FileDropzone options={{ maxSize: 1 }} />);

    dispatchEvt(screen.getByTestId('dropzone'), 'drop', mockData(files));

    expect(await screen.findByText('File is larger than 1 B')).toBeInTheDocument();
  });

  it('should show the accepted file type(s) when passed in as a array of strings', () => {
    render(<FileDropzone options={{ accept: ['.json', '.txt'] }} />);

    expect(screen.getByText('Accepted file types: .json, .txt')).toBeInTheDocument();
  });

  it('should show the accepted file type(s) when passed in as an `Accept` object', () => {
    render(<FileDropzone options={{ accept: { 'text/*': ['.json', '.txt'] } }} />);

    expect(screen.getByText('Accepted file types: .json, .txt')).toBeInTheDocument();
  });

  it('should handle file removal from the list', async () => {
    const user = userEvent.setup();
    render(<FileDropzone />);

    dispatchEvt(screen.getByTestId('dropzone'), 'drop', mockData(files));

    expect(await screen.findAllByLabelText(REMOVE_FILE)).toHaveLength(3);

    await user.click(screen.getAllByLabelText(REMOVE_FILE)[0]);

    expect(await screen.findAllByLabelText(REMOVE_FILE)).toHaveLength(2);
  });

  it('should overwrite selected file when multiple false', async () => {
    render(<FileDropzone options={{ multiple: false }} />);

    dispatchEvt(screen.getByTestId('dropzone'), 'drop', mockData([file({})]));

    expect(await screen.findAllByLabelText(REMOVE_FILE)).toHaveLength(1);
    expect(screen.getByText('ping.json')).toBeInTheDocument();

    dispatchEvt(screen.getByTestId('dropzone'), 'drop', mockData([file({ fileName: 'newFile.jpg' })]));

    expect(await screen.findByText('newFile.jpg')).toBeInTheDocument();
    expect(screen.getAllByLabelText(REMOVE_FILE)).toHaveLength(1);
  });

  it('should use the passed readAs prop with the FileReader API', async () => {
    render(<FileDropzone readAs="readAsDataURL" />);
    const fileReaderSpy = jest.spyOn(FileReader.prototype, 'readAsDataURL');

    dispatchEvt(screen.getByTestId('dropzone'), 'drop', mockData([file({})]));

    expect(await screen.findByText('ping.json')).toBeInTheDocument();
    expect(fileReaderSpy).toBeCalled();
  });

  it('should use the readAsText FileReader API if no readAs prop passed', async () => {
    render(<FileDropzone />);
    const fileReaderSpy = jest.spyOn(FileReader.prototype, 'readAsText');

    dispatchEvt(screen.getByTestId('dropzone'), 'drop', mockData([file({})]));

    expect(await screen.findByText('ping.json')).toBeInTheDocument();
    expect(fileReaderSpy).toBeCalled();
  });

  it('should use the onDrop that is passed', async () => {
    const onDrop = jest.fn();
    const fileToUpload = file({});
    render(<FileDropzone options={{ onDrop }} />);
    const fileReaderSpy = jest.spyOn(FileReader.prototype, 'readAsText');

    dispatchEvt(screen.getByTestId('dropzone'), 'drop', mockData([fileToUpload]));

    expect(await screen.findByText('ping.json')).toBeInTheDocument();
    expect(fileReaderSpy).not.toBeCalled();
    expect(onDrop).toHaveBeenCalledWith([fileToUpload], [], expect.anything());
  });

  it('should show children inside the dropzone', () => {
    const component = (
      <FileDropzone>
        <p>Custom dropzone text</p>
      </FileDropzone>
    );
    render(component);

    expect(screen.getByText('Custom dropzone text')).toBeInTheDocument();
  });

  it('should handle file list overwrite when fileListRenderer is passed', async () => {
    render(<FileDropzone fileListRenderer={() => null} />);

    dispatchEvt(screen.getByTestId('dropzone'), 'drop', mockData([file({})]));

    // need to await this in order to have the drop finished
    await screen.findByTestId('dropzone');

    expect(screen.queryByText('ping.json')).not.toBeInTheDocument();
  });
});

function dispatchEvt(node: HTMLElement, type: string, data: unknown) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, data);
  fireEvent(node, event);
}

function mockData(files: File[]) {
  return {
    dataTransfer: {
      files,
      items: files.map((file) => ({
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      })),
      types: ['Files'],
    },
  };
}
