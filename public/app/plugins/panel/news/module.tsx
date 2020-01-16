import { PanelPlugin } from '@grafana/data';
import { NewsPanel } from './NewsPanel';
// import { NewsPanelEditor } from './NewsPanelEditor';

export const plugin = new PanelPlugin(NewsPanel);
