import React from 'react';
import { mount } from 'enzyme';
import { DataLinks } from './DataLinks';
import { Button } from '@grafana/ui';
import { DataLink } from './DataLink';
import { act } from 'react-dom/test-utils';

describe('DataLinks', () => {
  let originalGetSelection: typeof window.getSelection;
  beforeAll(() => {
    originalGetSelection = window.getSelection;
    window.getSelection = () => null;
  });

  afterAll(() => {
    window.getSelection = originalGetSelection;
  });

  it('renders correctly when no fields', async () => {
    let wrapper: any;
    await act(
      // @ts-ignore we shouldn't use Promises in act => the "void | undefined" is here to forbid any sneaky "Promise" returns.
      async () => {
        wrapper = await mount(<DataLinks onChange={() => {}} />);
      }
    );
    expect(wrapper.find(Button).length).toBe(1);
    expect(wrapper.find(Button).contains('Add')).toBeTruthy();
    expect(wrapper.find(DataLink).length).toBe(0);
  });

  it('renders correctly when there are fields', async () => {
    let wrapper: any;
    await act(
      // @ts-ignore we shouldn't use Promises in act => the "void | undefined" is here to forbid any sneaky "Promise" returns.
      async () => {
        wrapper = await mount(<DataLinks value={testValue} onChange={() => {}} />);
      }
    );

    expect(wrapper.find(Button).filterWhere((button: any) => button.contains('Add')).length).toBe(1);
    expect(wrapper.find(DataLink).length).toBe(2);
  });

  it('adds new field', async () => {
    const onChangeMock = jest.fn();
    let wrapper: any;
    await act(
      // @ts-ignore we shouldn't use Promises in act => the "void | undefined" is here to forbid any sneaky "Promise" returns.
      async () => {
        wrapper = await mount(<DataLinks onChange={onChangeMock} />);
      }
    );
    const addButton = wrapper.find(Button).filterWhere((button: any) => button.contains('Add'));
    addButton.simulate('click');
    expect(onChangeMock.mock.calls[0][0].length).toBe(1);
  });

  it('removes field', async () => {
    const onChangeMock = jest.fn();
    let wrapper: any;
    await act(
      // @ts-ignore we shouldn't use Promises in act => the "void | undefined" is here to forbid any sneaky "Promise" returns.
      async () => {
        wrapper = await mount(<DataLinks value={testValue} onChange={onChangeMock} />);
      }
    );
    const removeButton = wrapper
      .find(DataLink)
      .at(0)
      .find(Button);
    removeButton.simulate('click');
    const newValue = onChangeMock.mock.calls[0][0];
    expect(newValue.length).toBe(1);
    expect(newValue[0]).toMatchObject({
      field: 'regex2',
      url: 'localhost2',
    });
  });
});

const testValue = [
  {
    field: 'regex1',
    url: 'localhost1',
  },
  {
    field: 'regex2',
    url: 'localhost2',
  },
];
