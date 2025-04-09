import { DataFrame, PanelMenuItem } from '@grafana/data';
import { isPluginExtensionLink } from '@grafana/runtime';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
  VizPanelMenu,
} from '@grafana/scenes';
import { getExploreUrl } from 'app/core/utils/explore';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';
import { createPluginExtensionsGetter } from 'app/features/plugins/extensions/getPluginExtensions';
import { pluginExtensionRegistries } from 'app/features/plugins/extensions/registry/setup';
import { type GetPluginExtensions } from 'app/features/plugins/extensions/types';

import { AddToExplorationButton, extensionPointId } from '../MetricSelect/AddToExplorationsButton';
import { getDataSource, getTrailFor } from '../utils';

const ADD_TO_INVESTIGATION_MENU_TEXT = 'Add to investigation';
const ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT = 'investigations_divider'; // Text won't be visible
const ADD_TO_INVESTIGATION_MENU_GROUP_TEXT = 'Investigations';

interface PanelMenuState extends SceneObjectState {
  body?: VizPanelMenu;
  frame?: DataFrame;
  labelName?: string;
  fieldName?: string;
  addExplorationsLink?: boolean;
  explorationsButton?: AddToExplorationButton;
}

let getPluginExtensions: GetPluginExtensions;

function setupGetPluginExtensions() {
  if (getPluginExtensions) {
    return getPluginExtensions;
  }

  getPluginExtensions = createPluginExtensionsGetter(pluginExtensionRegistries);

  return getPluginExtensions;
}

/**
 * @todo the VizPanelMenu interface is overly restrictive, doesn't allow any member functions on this class, so everything is currently inlined
 */
export class PanelMenu extends SceneObjectBase<PanelMenuState> implements VizPanelMenu, SceneObject {
  constructor(state: Partial<PanelMenuState>) {
    super({ ...state, addExplorationsLink: state.addExplorationsLink ?? true });
    this.addActivationHandler(() => {
      let exploreUrl: Promise<string | undefined> | undefined;
      try {
        const viz = sceneGraph.getAncestor(this, VizPanel);
        const queryRunner = getQueryRunnerFor(viz);
        const queries = queryRunner?.state.queries ?? [];
        queries.forEach((query) => {
          // removing legendFormat to get verbose legend in Explore
          delete query.legendFormat;
        });
        const trail = getTrailFor(this);
        const dsValue = getDataSource(trail);
        const timeRange = sceneGraph.getTimeRange(this);
        exploreUrl = getExploreUrl({
          queries,
          dsRef: { uid: dsValue },
          timeRange: timeRange.state.value,
          scopedVars: { __sceneObject: { value: viz } },
        });
      } catch (e) {}

      // Navigation options (all panels)
      const items: PanelMenuItem[] = [
        {
          text: 'Navigation',
          type: 'group',
        },
        {
          text: 'Explore',
          iconClassName: 'compass',
          onClick: () => exploreUrl?.then((url) => url && window.open(url, '_blank')),
          shortcut: 'p x',
        },
      ];

      this.setState({
        body: new VizPanelMenu({
          items,
        }),
      });

      const addToExplorationsButton = new AddToExplorationButton({
        labelName: this.state.labelName,
        fieldName: this.state.fieldName,
        frame: this.state.frame,
      });
      this._subs.add(
        addToExplorationsButton?.subscribeToState(() => {
          subscribeToAddToExploration(this);
        })
      );
      this.setState({
        explorationsButton: addToExplorationsButton,
      });

      if (this.state.addExplorationsLink) {
        this.state.explorationsButton?.activate();
      }
    });

    setupGetPluginExtensions();
  }

  addItem(item: PanelMenuItem): void {
    if (this.state.body) {
      this.state.body.addItem(item);
    }
  }

  setItems(items: PanelMenuItem[]): void {
    if (this.state.body) {
      this.state.body.setItems(items);
    }
  }

  public static Component = ({ model }: SceneComponentProps<PanelMenu>) => {
    const { body } = model.useState();

    if (body) {
      return <body.Component model={body} />;
    }

    return <></>;
  };
}

const getInvestigationLink = (addToExplorations: AddToExplorationButton) => {
  const links = getPluginExtensions({
    extensionPointId,
    context: addToExplorations.state.context,
  }).extensions.filter((ext) => isPluginExtensionLink(ext));

  return links[0];
};

const onAddToInvestigationClick = (event: React.MouseEvent, addToExplorations: AddToExplorationButton) => {
  const link = getInvestigationLink(addToExplorations);
  if (link && link.onClick) {
    link.onClick(event);
  }
};

function subscribeToAddToExploration(menu: PanelMenu) {
  const addToExplorationButton = menu.state.explorationsButton;
  if (addToExplorationButton) {
    const link = getInvestigationLink(addToExplorationButton);

    const existingMenuItems = menu.state.body?.state.items ?? [];

    const existingAddToExplorationLink = existingMenuItems.find((item) => item.text === ADD_TO_INVESTIGATION_MENU_TEXT);

    if (link) {
      if (!existingAddToExplorationLink) {
        menu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT,
          type: 'divider',
        });
        menu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_GROUP_TEXT,
          type: 'group',
        });
        menu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_TEXT,
          iconClassName: 'plus-square',
          onClick: (e) => onAddToInvestigationClick(e, addToExplorationButton),
        });
      } else {
        if (existingAddToExplorationLink) {
          menu.state.body?.setItems(
            existingMenuItems.filter(
              (item) =>
                [
                  ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT,
                  ADD_TO_INVESTIGATION_MENU_GROUP_TEXT,
                  ADD_TO_INVESTIGATION_MENU_TEXT,
                ].includes(item.text) === false
            )
          );
        }
      }
    }
  }
}
