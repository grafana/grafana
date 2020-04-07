import Plain from 'slate-plain-serializer';
import React from 'react';
import { Editor } from '@grafana/slate-react';
import { shallow } from 'enzyme';
import { RunnerPlugin } from './runner';

describe('runner', () => {
  const mockHandler = jest.fn();
  const handler = RunnerPlugin({ handler: mockHandler }).onKeyDown!;

  it('should execute query when enter is pressed and there are no suggestions visible', () => {
    const value = Plain.deserialize('');
    const editor = shallow<Editor>(<Editor value={value} />);
    handler({ key: 'Enter', preventDefault: () => {} } as KeyboardEvent, editor.instance() as any, () => {});
    expect(mockHandler).toBeCalled();
  });
});
