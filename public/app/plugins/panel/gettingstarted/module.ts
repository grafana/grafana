import { PanelPlugin } from '@grafana/data';
import { GettingStarted } from './GettingStarted';

// Simplest possible panel plugin
export const plugin = new PanelPlugin(GettingStarted).setNoPadding();
