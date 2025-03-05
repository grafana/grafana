import { SceneAppPage } from '@grafana/scenes';
import { helloWorldScene } from './helloWorldScene';
import { prefixRoute } from '../../utils/utils.routing';
import { ROUTES } from '../../constants';

export const helloWorldPage = new SceneAppPage({
  title: 'Stock Anomaly Detection',
  url: prefixRoute(ROUTES.HelloWorld),
  getScene: helloWorldScene,
});
