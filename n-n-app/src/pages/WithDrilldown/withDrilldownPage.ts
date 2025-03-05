import { EmbeddedScene, SceneAppPage, SceneFlexLayout, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { withDrilldownScene } from './withDrilldownScene';
import { temperatureOverviewScene } from './temperatureOverviewScene';
import { humidityOverviewPage } from './humidityOverviewPage';

export const withDrilldownPage = new SceneAppPage({
  $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
  title: 'Page with drilldown',
  subTitle: 'This scene showcases a basic drilldown functionality. Interact with room to see room details scene.',
  controls: [new SceneTimePicker({ isOnCanvas: true })],
  url: prefixRoute(ROUTES.WithDrilldown),
  hideFromBreadcrumbs: true,
  getScene: withDrilldownScene,
  drilldowns: [
    {
      routePath: `${prefixRoute(ROUTES.WithDrilldown)}/room/:roomName`,
      getPage(routeMatch, parent) {
        const roomName = routeMatch.params.roomName;
        return new SceneAppPage({
          url: `${prefixRoute(ROUTES.WithDrilldown)}/room/${roomName}/temperature`,
          title: `${decodeURIComponent(roomName)} overview`,
          subTitle: 'This scene is a particular room drilldown. It implements two tabs to organise the data.',
          getParentPage: () => parent,
          getScene: () => {
            return new EmbeddedScene({ body: new SceneFlexLayout({ children: [] }) });
          },
          tabs: [
            new SceneAppPage({
              title: 'Temperature',
              url: `${prefixRoute(ROUTES.WithDrilldown)}/room/${roomName}/temperature`,
              getScene: () => temperatureOverviewScene(roomName),
            }),
            humidityOverviewPage(roomName),
          ],
        });
      },
    },
  ],
});
