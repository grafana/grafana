import { createContext } from 'react';
import { ChecksReload } from './types';

export const ChecksReloadContext = createContext<ChecksReload>({ fetchChecks: async () => {} });
