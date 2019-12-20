import { PanelPlugin } from '@grafana/data';
import { NewsPanel } from './NewsPanel';
import { NewsPanelEditor } from './NewsPanelEditor';
import { defaults, NewsOptions } from './types';

export const plugin = new PanelPlugin<NewsOptions>(NewsPanel).setDefaults(defaults).setEditor(NewsPanelEditor);
