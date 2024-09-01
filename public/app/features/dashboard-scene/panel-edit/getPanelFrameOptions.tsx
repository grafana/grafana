import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { DataLinksInlineEditor, Input, TextArea, Switch } from '@grafana/ui';
import { GenAIPanelDescriptionButton } from 'app/features/dashboard/components/GenAI/GenAIPanelDescriptionButton';
import { GenAIPanelTitleButton } from 'app/features/dashboard/components/GenAI/GenAIPanelTitleButton';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { VizPanelLinks } from '../scene/PanelLinks';
import { DashboardLayoutElement } from '../scene/layouts/types';
import { vizPanelToPanel, transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../utils/utils';

import { VizPanelManager } from './VizPanelManager';

export function getPanelFrameCategory2(
  vizManager: VizPanelManager,
  panel: VizPanel,
  layoutElement: DashboardLayoutElement
): OptionsPaneCategoryDescriptor {
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: 'Panel options',
    id: 'Panel options',
    isOpenDefault: true,
  });

  const panelLinksObject = dashboardSceneGraph.getPanelLinks(panel);
  const links = panelLinksObject?.state.rawLinks ?? [];
  const dashboard = getDashboardSceneFor(panel);

  descriptor
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Title',
        value: panel.state.title,
        popularRank: 1,
        render: function renderTitle() {
          return <PanelFrameTitle vizManager={vizManager} />;
        },
        addon: config.featureToggles.dashgpt && (
          <GenAIPanelTitleButton
            onGenerate={(title) => vizManager.setPanelTitle(title)}
            panel={vizPanelToPanel(panel)}
            dashboard={transformSceneToSaveModel(dashboard)}
          />
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Description',
        value: panel.state.description,
        render: function renderDescription() {
          return <DescriptionTextArea panel={panel} />;
        },
        addon: config.featureToggles.dashgpt && (
          <GenAIPanelDescriptionButton
            onGenerate={(description) => panel.setState({ description })}
            panel={vizPanelToPanel(panel)}
          />
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: 'Transparent background',
        render: function renderTransparent() {
          return (
            <Switch
              value={panel.state.displayMode === 'transparent'}
              id="transparent-background"
              onChange={() => {
                panel.setState({
                  displayMode: panel.state.displayMode === 'transparent' ? 'default' : 'transparent',
                });
              }}
            />
          );
        },
      })
    )
    .addCategory(
      new OptionsPaneCategoryDescriptor({
        title: 'Panel links',
        id: 'Panel links',
        isOpenDefault: false,
        itemsCount: links?.length,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: 'Panel links',
          render: () => <ScenePanelLinksEditor panelLinks={panelLinksObject ?? undefined} />,
        })
      )
    );

  const layoutElementOptions = layoutElement.getOptions?.() ?? [];

  if (layoutElementOptions.length > 0) {
    const category = new OptionsPaneCategoryDescriptor({
      title: 'Layout options',
      id: 'Layout options',
      isOpenDefault: false,
    });

    for (let option of layoutElementOptions) {
      category.addItem(option);
    }

    descriptor.addCategory(category);
  }

  return descriptor;
}

interface ScenePanelLinksEditorProps {
  panelLinks?: VizPanelLinks;
}

function ScenePanelLinksEditor({ panelLinks }: ScenePanelLinksEditorProps) {
  const { rawLinks: links } = panelLinks ? panelLinks.useState() : { rawLinks: [] };

  return (
    <DataLinksInlineEditor
      links={links}
      onChange={(links) => panelLinks?.setState({ rawLinks: links })}
      getSuggestions={getPanelLinksVariableSuggestions}
      data={[]}
    />
  );
}

function PanelFrameTitle({ vizManager }: { vizManager: VizPanelManager }) {
  const { title } = vizManager.state.panel.useState();

  return (
    <Input
      data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Title')}
      value={title}
      onChange={(e) => vizManager.setPanelTitle(e.currentTarget.value)}
    />
  );
}

function DescriptionTextArea({ panel }: { panel: VizPanel }) {
  const { description } = panel.useState();

  return (
    <TextArea
      id="description-text-area"
      value={description}
      onChange={(e) => panel.setState({ description: e.currentTarget.value })}
    />
  );
}
