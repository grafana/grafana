import { shallow } from 'enzyme';
import React from 'react';
import Plain from 'slate-plain-serializer';
import { Editor } from 'slate-react';

import { RunnerPlugin } from './runner';

describe('runner', () => {
  const mockHandler = jest.fn();
  const handler = RunnerPlugin({ handler: mockHandler }).onKeyDown!;

  it('should execute query when enter with shift is pressed', () => {
    const value = Plain.deserialize('');
    const editor = shallow(<Editor value={value} />);
    handler(
      new window.KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
      }) as any,
      editor.instance() as Editor,
      () => {}
    );
    expect(mockHandler).toBeCalled();
  });
});
