import React from 'react';
import { EventBusWithSource } from './EventBus';

export const EventBusWithSourceContext = React.createContext<EventBusWithSource | undefined>(undefined);
