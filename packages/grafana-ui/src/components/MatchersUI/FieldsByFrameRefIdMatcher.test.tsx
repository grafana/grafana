import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { toDataFrame, FieldType } from '@grafana/data';

import { RefIDPicker, Props } from './FieldsByFrameRefIdMatcher';

beforeEach(() => {
  jest.clearAllMocks();
});

const frame1 = toDataFrame({
  refId: 'A',
  name: 'Series A',
  fields: [],
});

const frame2 = toDataFrame({
  refId: 'A',
  fields: [{ name: 'Value', type: FieldType.number, values: [10, 200], config: { displayName: 'Second series' } }],
});

const frame3 = toDataFrame({
  refId: 'B',
  name: 'Series B',
  fields: [],
});

const mockOnChange = jest.fn();

const props: Props = {
  data: [frame1, frame2, frame3],
  onChange: mockOnChange,
};

const setup = (testProps?: Partial<Props>) => {
  const editorProps = { ...props, ...testProps };
  return render(<RefIDPicker {...editorProps} />);
};

describe('RefIDPicker', () => {
  it('Should be able to select frame', async () => {
    setup();

    const select = await screen.findByRole('combobox');
    fireEvent.keyDown(select, { keyCode: 40 });

    const selectOptions = screen.getAllByLabelText('Select option');

    expect(selectOptions).toHaveLength(2);
    expect(selectOptions[0]).toHaveTextContent('Query: AFrames (2): Series A, Second series');
    expect(selectOptions[1]).toHaveTextContent('Query: BFrames (1): Series B');
  });
});
