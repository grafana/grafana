import { AppPlugin } from '@grafana/data';
import App from './components/App/App';

export const plugin = new AppPlugin<{}>().setRootPage(App);
