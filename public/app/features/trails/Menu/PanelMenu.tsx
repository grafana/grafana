import { DataFrame, PanelMenuItem } from '@grafana/data';
import { getPluginLinkExtensions } from '@grafana/runtime';
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

import { AddToInvestigationButton, extensionPointId } from '../MetricSelect/AddToInvestigationButton';
import { getDataSource, getTrailFor } from '../utils';

const ADD_TO_INVESTIGATION_MENU_TEXT = 'Add to investigation';
const ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT = 'investigations_divider'; // Text won't be visible
const ADD_TO_INVESTIGATION_MENU_GROUP_TEXT = 'Investigations';

interface PanelMenuState extends SceneObjectState {
  body?: VizPanelMenu;
  frame?: DataFrame;
  labelName?: string;
  fieldName?: string;
  addInvestigationLink?: boolean;
  investigationButton?: AddToInvestigationButton;
}

/**
 * @todo the VizPanelMenu interface is overly restrictive, doesn't allow any member functions on this class, so everything is currently inlined
 */
export class PanelMenu extends SceneObjectBase<PanelMenuState> implements VizPanelMenu, SceneObject {
  constructor(state: Partial<PanelMenuState>) {
    super({ ...state, addInvestigationLink: state.addInvestigationLink ?? true });
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

      const addToInvestigationButton = new AddToInvestigationButton({
        labelName: this.state.labelName,
        fieldName: this.state.fieldName,
        frame: this.state.frame,
      });
      this._subs.add(
        addToInvestigationButton?.subscribeToState(() => {
          subscribeToAddToInvestigation(this);
        })
      );
      this.setState({
        investigationButton: addToInvestigationButton,
      });

      if (this.state.addInvestigationLink) {
        this.state.investigationButton?.activate();
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

const getInvestigationLink = (addToInvestigation: AddToInvestigationButton) => {
  const links = getPluginLinkExtensions({
    extensionPointId: extensionPointId,
    context: addToInvestigation.state.context,
  });

  return links.extensions[0];
};

const onAddToInvestigationClick = (event: React.MouseEvent, addToInvestigation: AddToInvestigationButton) => {
  const link = getInvestigationLink(addToInvestigation);
  if (link && link.onClick) {
    link.onClick(event);
  }
};

function subscribeToAddToInvestigation(menu: PanelMenu) {
  const addToInvestigationButton = menu.state.investigationButton;
  if (addToInvestigationButton) {
    const link = getInvestigationLink(addToInvestigationButton);

    const existingMenuItems = menu.state.body?.state.items ?? [];

    const existingAddToInvestigationLink = existingMenuItems.find((item) => item.text === ADD_TO_INVESTIGATION_MENU_TEXT);

    if (link) {
      if (!existingAddToInvestigationLink) {
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
          onClick: (e) => onAddToInvestigationClick(e, addToInvestigationButton),
        });
      } else {
        if (existingAddToInvestigationLink) {
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
