import { PanelPlugin } from '@grafana/ui';
import { GettingStarted } from './GettingStarted';

// Simplest possible panel plugin
export const plugin = new PanelPlugin(GettingStarted);
