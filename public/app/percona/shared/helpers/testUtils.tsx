import { ReactNode } from 'react';
import { act } from 'react-dom/test-utils';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { GrafanaContext } from 'app/core/context/GrafanaContext';

export const asyncAct = (cb: () => any): Promise<any> => {
  //@ts-ignore
  return act(async () => cb());
};

export const wrapWithGrafanaContextMock = (children: ReactNode) => (
  <GrafanaContext.Provider value={getGrafanaContextMock()}>{children}</GrafanaContext.Provider>
);
