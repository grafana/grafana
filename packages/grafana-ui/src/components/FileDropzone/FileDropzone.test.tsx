import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { FileDropzone } from './FileDropzone';

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

  it('should show accepted file type when passed in the options as a string', () => {
    render(<FileDropzone options={{ accept: '.json' }} />);

    expect(screen.getByText('Accepted file type: .json')).toBeInTheDocument();
  });

  it('should show accepted file types when passed in the options as a string array', () => {
    render(<FileDropzone options={{ accept: ['.json', '.txt'] }} />);

    expect(screen.getByText('Accepted file types: .json, .txt')).toBeInTheDocument();
  });

  it('should handle file removal from the list', async () => {
    const { rerender, container } = render(<FileDropzone />);
    const dropzone = container.querySelector('div[TabIndex="0"]');

    dispatchEvt(dropzone, 'drop', mockData(files));

    await flushPromises(rerender, <FileDropzone />);

    expect(screen.getAllByLabelText('Remove')).toHaveLength(3);

    fireEvent.click(screen.getAllByLabelText('Remove')[0]);

    expect(screen.getAllByLabelText('Remove')).toHaveLength(2);
  });

  it('should overwrite selected file when multiple false', async () => {
    const component = <FileDropzone options={{ multiple: false }} />;
    const { rerender, container } = render(component);
    const dropzone = container.querySelector('div[TabIndex="0"]');

    dispatchEvt(dropzone, 'drop', mockData([file({})]));
    await flushPromises(rerender, component);

    expect(screen.getAllByLabelText('Remove')).toHaveLength(1);
    expect(screen.getByText('ping.json')).toBeInTheDocument();

    dispatchEvt(dropzone, 'drop', mockData([file({ fileName: 'newFile.jpg' })]));
    await flushPromises(rerender, component);

    expect(screen.getByText('newFile.jpg')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Remove')).toHaveLength(1);
  });

  it('should use the passed readAs prop with the FileReader API', async () => {
    const component = <FileDropzone readAs="readAsDataURL" />;
    const { rerender, container } = render(component);
    const dropzone = container.querySelector('div[TabIndex="0"]');
    const fileReaderSpy = jest.spyOn(FileReader.prototype, 'readAsDataURL');

    dispatchEvt(dropzone, 'drop', mockData([file({})]));

    await flushPromises(rerender, component);

    expect(fileReaderSpy).toBeCalled();
  });

  it('should use the readAsText FileReader API if no readAs prop passed', async () => {
    const component = <FileDropzone />;
    const { rerender, container } = render(component);
    const dropzone = container.querySelector('div[TabIndex="0"]');
    const fileReaderSpy = jest.spyOn(FileReader.prototype, 'readAsText');

    dispatchEvt(dropzone, 'drop', mockData([file({})]));

    await flushPromises(rerender, component);

    expect(fileReaderSpy).toBeCalled();
  });

  it('should use the onDrop that is passed', async () => {
    const onDrop = jest.fn();
    const component = <FileDropzone options={{ onDrop }} />;
    const fileToUpload = file({});
    const { rerender, container } = render(component);
    const dropzone = container.querySelector('div[TabIndex="0"]');
    const fileReaderSpy = jest.spyOn(FileReader.prototype, 'readAsText');

    dispatchEvt(dropzone, 'drop', mockData([fileToUpload]));

    await flushPromises(rerender, component);

    expect(fileReaderSpy).not.toBeCalled();
    expect(onDrop).toBeCalledWith([fileToUpload], [], expect.anything());
  });

  it('should show children inside the dropzone', () => {
    const component = (
      <FileDropzone>
        <p>Custom dropzone text</p>
      </FileDropzone>
    );
    render(component);

    screen.getByText('Custom dropzone text');
  });
});

async function flushPromises(rerender: any, ui: ReactNode) {
  await act(() => waitFor(() => rerender(ui)));
}

function dispatchEvt(node: any, type: string, data: any) {
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
