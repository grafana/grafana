import { fireEvent, render, screen } from '@testing-library/react';

import { toDataFrame, FieldType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import {
  RefIDPicker,
  Props,
  RefIDMultiPicker,
  MultiProps,
  stringsToRegexp,
  regexpToStrings,
} from './FieldsByFrameRefIdMatcher';

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

const multiProps: MultiProps = {
  data: [frame1, frame2, frame3],
  onChange: mockOnChange,
};

const setup = (testProps?: Partial<Props>) => {
  const editorProps = { ...props, ...testProps };
  return render(<RefIDPicker {...editorProps} />);
};

const multiSetup = (testProps?: Partial<MultiProps>) => {
  const editorProps = { ...multiProps, ...testProps };
  return render(<RefIDMultiPicker {...editorProps} />);
};

describe('RefIDPicker', () => {
  it('Should be able to select frame', async () => {
    setup();

    const select = await screen.findByRole('combobox');
    fireEvent.keyDown(select, { keyCode: 40 });

    const selectOptions = screen.getAllByTestId(selectors.components.Select.option);

    expect(selectOptions).toHaveLength(2);
    expect(selectOptions[0]).toHaveTextContent('Query: AFrames (2): Series A, Second series');
    expect(selectOptions[1]).toHaveTextContent('Query: BFrames (1): Series B');
  });
});

describe('RefIDMultiPicker', () => {
  const namesRegexp = /^(?:a|b \(ttt\)|bla\.foo|zzz\|cow|\$dollar\[baz\])$/;
  const namesArray = ['a', 'b (ttt)', 'bla.foo', 'zzz|cow', '$dollar[baz]'];

  it('creates regexp string from array of names', async () => {
    const names = regexpToStrings(namesRegexp.toString());
    expect(names).toEqual(namesArray);
  });

  it('creates array of names from regexp string', async () => {
    const regexpStr = stringsToRegexp(namesArray);
    expect(regexpStr).toEqual(namesRegexp.toString());
  });

  it('Should be able to select frame', async () => {
    multiSetup();

    const select = await screen.findByRole('combobox');
    fireEvent.keyDown(select, { keyCode: 40 });

    const selectOptions = screen.getAllByTestId(selectors.components.Select.option);

    expect(selectOptions).toHaveLength(2);
    expect(selectOptions[0]).toHaveTextContent('Query: AFrames (2): Series A, Second series');
    expect(selectOptions[1]).toHaveTextContent('Query: BFrames (1): Series B');

    fireEvent.keyDown(select, { keyCode: 13 });
    fireEvent.keyDown(select, { keyCode: 40 });
    fireEvent.keyDown(select, { keyCode: 13 });

    expect(mockOnChange).toHaveBeenLastCalledWith(['A', 'B']);
  });
});
