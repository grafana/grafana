import { PanelPlugin } from '@grafana/data';
import { DashGenPanel } from './DashGenPanel';
import { loader } from './loader';

export const plugin = new PanelPlugin(DashGenPanel);

// HACK: expose the dashboard loader here
(plugin as any).dashboardSupport = loader;
