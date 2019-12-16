import { PanelPlugin } from '@grafana/data';
import { NewsPanel } from './components/NewsPanel';
import { NewsPanelEditor } from './components/NewsPanelEditor';
import { defaults, NewsOptions } from './types';

export const plugin = new PanelPlugin<NewsOptions>(NewsPanel).setDefaults(defaults).setEditor(NewsPanelEditor);
