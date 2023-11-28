import { act } from 'react-dom/test-utils';

export const asyncAct = (cb: () => any): Promise<any> => {
  //@ts-ignore
  return act(async () => cb());
};
