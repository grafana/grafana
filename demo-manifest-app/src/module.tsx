import { lazy } from 'react';
import { AppPlugin } from '@grafana/data';

const App = lazy(() => import('./components/App/App'));

export const plugin = new AppPlugin<{}>().setRootPage(App);
