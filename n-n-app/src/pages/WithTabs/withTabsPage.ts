import { SceneAppPage, EmbeddedScene } from '@grafana/scenes';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { homeScene } from '../Home/homeScene';

//import { homeScene2 } from '../Home/homeSceneMyData';

const getTab1Scene = () => {
  return homeScene(false, '__server_names');
};

const getTab2Scene = () => {
  return homeScene(false, '__house_locations');
};


const getTab3Scene = (): EmbeddedScene => {
  return homeScene(false, '__house_locations') as EmbeddedScene;
};

export const withTabsPage = new SceneAppPage({
  title: 'Page with tabs',
  subTitle: 'This scene showcases a basic tabs functionality.',
  // Important: Mind the page route is ambiguous for the tabs to work properly
  url: prefixRoute(ROUTES.WithTabs),
  hideFromBreadcrumbs: true,
  getScene: getTab1Scene,
  tabs: [
    new SceneAppPage({
      title: 'Server444 names',
      url: prefixRoute(ROUTES.WithTabs),
      getScene: getTab1Scene,
    }),
    new SceneAppPage({
      title: 'House locations',
      url: prefixRoute(`${ROUTES.WithTabs}/tab-two`),
      getScene: getTab2Scene,
    }),
    new SceneAppPage({
      title: 'My custom tab',
      url: prefixRoute(`${ROUTES.WithTabs}/tab-three`),
      getScene: getTab3Scene,
    }),
  ],
});
