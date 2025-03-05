import { SceneAppPage } from '@grafana/scenes';
import { homeScene } from './homeScene';
import { prefixRoute } from '../../utils/utils.routing';
import { ROUTES } from '../../constants';


export const homePage = new SceneAppPage({
  title: 'Home page',
  url: prefixRoute(ROUTES.Home),
  subTitle:
    'This scene showcases a basic scene functionality, including query runner, variable and a custom scene object.',
  getScene: () => homeScene(),
});