// Libraries
import React, { PureComponent } from 'react';

// Services
import { getTimeSrv } from 'app/features/dashboard/time_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { store } from 'app/store/configureStore';

// Components
import { PanelHeaderMenu } from 'app/features/dashboard/dashgrid/PanelHeader/PanelHeaderMenu';
import config from 'app/core/config';
import { getExploreUrl } from 'app/core/utils/explore';
import { updateLocation } from 'app/core/actions';

// Types
import { PanelModel } from 'app/features/dashboard/panel_model';
import { PanelHeaderMenuProps } from 'app/features/dashboard/dashgrid/PanelHeader/PanelHeaderMenu';
import {
  PanelHeaderMenuItemProps,
  PanelHeaderMenuItemTypes,
} from 'app/features/dashboard/dashgrid/PanelHeader/PanelHeaderMenuItem';

interface LocalState {
  datasource: any;
}

export const withMenuOptions = (WrappedPanelHeaderMenu: typeof PanelHeaderMenu, panel: PanelModel) => {
  return class extends PureComponent<PanelHeaderMenuProps, LocalState> {
    private datasourceSrv = getDatasourceSrv();
    private timeSrv = getTimeSrv();

    constructor(props) {
      super(props);
      this.state = {
        datasource: undefined,
      };
    }

    componentDidMount() {
      const dsPromise = getDatasourceSrv().get(panel.datasource);
      dsPromise.then((datasource: any) => {
        this.setState(() => ({ datasource }));
      });
    }

    onExploreClick = async () => {
      const { datasource } = this.state;
      const url = await getExploreUrl(panel, panel.targets, datasource, this.datasourceSrv, this.timeSrv);
      if (url) {
        store.dispatch(updateLocation({ path: url }));
      }
    };

    getAdditionalMenuItems = () => {
      const { datasource } = this.state;
      const items = [];
      if (
        config.exploreEnabled &&
        contextSrv.isEditor &&
        datasource &&
        (datasource.meta.explore || datasource.meta.id === 'mixed')
      ) {
        items.push({
          type: PanelHeaderMenuItemTypes.Link,
          text: 'Explore',
          handleClick: this.onExploreClick,
          iconClassName: 'fa fa-fw fa-rocket',
          shortcut: 'x',
        });
      }
      return items;
    };

    getAdditionalSubMenuItems = () => {
      return [
        {
          type: PanelHeaderMenuItemTypes.Link,
          text: 'Hello Sub Menu',
          handleClick: () => {
            alert('Hello world from HOC!');
          },
          shortcut: 's h w',
        },
      ] as PanelHeaderMenuItemProps[];
    };

    render() {
      const menu: PanelHeaderMenuItemProps[] = this.getAdditionalMenuItems();
      const subMenu: PanelHeaderMenuItemProps[] = this.getAdditionalSubMenuItems();
      return <WrappedPanelHeaderMenu {...this.props} additionalMenuItems={menu} additionalSubMenuItems={subMenu} />;
    }
  };
};
