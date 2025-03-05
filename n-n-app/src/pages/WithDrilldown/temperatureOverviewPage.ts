import { SceneAppPage } from '@grafana/scenes';
import { prefixRoute } from '../../utils/utils.routing';
import { ROUTES } from '../../constants';
import { temperatureOverviewScene } from './temperatureOverviewScene';

export function temperatureOverviewPage(roomName: string) {
  return new SceneAppPage({
    title: 'Temperature',
    url: `${prefixRoute(ROUTES.WithDrilldown)}/room/${roomName}/temperature`,
    getScene: () => temperatureOverviewScene(roomName),
  });
}
