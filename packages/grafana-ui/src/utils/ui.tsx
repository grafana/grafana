import React from 'react';
import { OpenDetailOptions } from '../types/ui';

export const OpenDetailContext = React.createContext<((options: OpenDetailOptions) => void) | undefined>(undefined);
