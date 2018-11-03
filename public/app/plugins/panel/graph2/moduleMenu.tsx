import config from 'app/core/config';
import { contextSrv } from 'app/core/services/context_srv';
import { getExploreUrl } from 'app/core/utils/explore';
import { updateLocation } from 'app/core/actions';
import { getTimeSrv } from 'app/features/dashboard/time_srv';
import { store } from 'app/store/configureStore';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import appEvents from 'app/core/app_events';

import {
  PanelHeaderMenuItemProps,
  PanelHeaderMenuItemTypes,
} from 'app/features/dashboard/dashgrid/PanelHeader/PanelHeaderMenuItem';

export const moduleMenu = (panel, dataSourceApi, timeSeries) => {
  const onExploreClick = async () => {
    const datasourceSrv = getDatasourceSrv();
    const timeSrv = getTimeSrv();
    const url = await getExploreUrl(panel, panel.targets, dataSourceApi, datasourceSrv, timeSrv);
    if (url) {
      store.dispatch(updateLocation({ path: url }));
    }
  };

  const onExportCsv = () => {
    const model = {} as { seriesList: string };
    model.seriesList = timeSeries;
    appEvents.emit('show-modal', {
      templateHtml: '<export-data-modal data="model.seriesList"></export-data-modal>',
      model,
      modalClass: 'modal--narrow',
    });
  };

  const getAdditionalMenuItems = () => {
    const items = [];
    if (
      config.exploreEnabled &&
      contextSrv.isEditor &&
      dataSourceApi &&
      (dataSourceApi.meta.explore || dataSourceApi.meta.id === 'mixed')
    ) {
      items.push({
        type: PanelHeaderMenuItemTypes.Link,
        text: 'Explore',
        handleClick: onExploreClick,
        iconClassName: 'fa fa-fw fa-rocket',
        shortcut: 'x',
      });
    }
    return items;
  };

  const getAdditionalSubMenuItems = () => {
    return [
      {
        type: PanelHeaderMenuItemTypes.Link,
        text: 'Hello Sub Menu',
        handleClick: () => {
          alert('Hello world from moduleMenu');
        },
        shortcut: 'hi',
      },
      {
        type: PanelHeaderMenuItemTypes.Link,
        text: 'Export CSV',
        handleClick: onExportCsv,
      },
    ] as PanelHeaderMenuItemProps[];
  };

  return {
    getAdditionalMenuItems: getAdditionalMenuItems(),
    getAdditionalSubMenuItems: getAdditionalSubMenuItems(),
  };
};
