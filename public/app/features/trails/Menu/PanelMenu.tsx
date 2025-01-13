import { DataFrame, PanelMenuItem } from '@grafana/data';
import { getPluginLinkExtensions } from '@grafana/runtime';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizPanelMenu,
} from '@grafana/scenes';

import { MetricActionBar, MetricScene } from '../MetricScene';
import { AddToExplorationButton, extensionPointId } from '../MetricSelect/AddToExplorationsButton';

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

/**
 * @todo the VizPanelMenu interface is overly restrictive, doesn't allow any member functions on this class, so everything is currently inlined
 */
export class PanelMenu extends SceneObjectBase<PanelMenuState> implements VizPanelMenu, SceneObject {
  constructor(state: Partial<PanelMenuState>) {
    super({ ...state, addExplorationsLink: state.addExplorationsLink ?? true });
    this.addActivationHandler(() => {
      // Navigation options (all panels)
      const items: PanelMenuItem[] = [
        {
          text: 'Navigation',
          type: 'group',
        },
        {
          text: 'Explore',
          iconClassName: 'compass',
          onClick: () => openExploreLink(this),
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

function openExploreLink(panel: PanelMenu) {
  const metricScene = sceneGraph.getAncestor(panel, MetricScene);
  const metricActionBars = sceneGraph.findDescendents(metricScene, MetricActionBar);
  if (metricActionBars.length === 0) {
    return;
  }
  const metricActionBar = metricActionBars[0] as MetricActionBar;
  metricActionBar.openExploreLink();
}

const getInvestigationLink = (addToExplorations: AddToExplorationButton) => {
  const links = getPluginLinkExtensions({
    extensionPointId: extensionPointId,
    context: addToExplorations.state.context,
  });

  return links.extensions[0];
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
