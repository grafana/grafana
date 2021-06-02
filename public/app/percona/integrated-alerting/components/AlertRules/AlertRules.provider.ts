import React from 'react';
import { AlertRulesContext } from './AlertRules.types';

export const AlertRulesProvider = React.createContext<AlertRulesContext>({} as AlertRulesContext);
