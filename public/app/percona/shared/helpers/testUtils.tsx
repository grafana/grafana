import { ReactElement } from 'react';
import { mount, ReactWrapper, shallow, ShallowWrapper } from 'enzyme';
import { act } from 'react-dom/test-utils';

export const getMount = async (node: ReactElement): Promise<ReactWrapper> => {
  let wrapper: ReactWrapper = {} as ReactWrapper;

  //@ts-ignore
  await act(async () => {
    wrapper = await mount(node);
  });

  return wrapper;
};

export const getShallow = async (node: ReactElement): Promise<ShallowWrapper> => {
  let wrapper: ShallowWrapper = {} as ShallowWrapper;

  //@ts-ignore
  await act(async () => {
    wrapper = await shallow(node);
  });

  return wrapper;
};

export const asyncAct = (cb: () => any): Promise<any> => {
  //@ts-ignore
  return act(async () => cb());
};
