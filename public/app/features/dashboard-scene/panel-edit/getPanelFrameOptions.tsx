import React from 'react';
import { v4 as uuidv4 } from 'uuid';

import { CoreApp } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneTimeRangeLike, VizPanel } from '@grafana/scenes';
import { DataLinksInlineEditor, Input, TextArea, Switch } from '@grafana/ui';
import { GenAIPanelDescriptionButton } from 'app/features/dashboard/components/GenAI/GenAIPanelDescriptionButton';
import { GenAIPanelTitleButton } from 'app/features/dashboard/components/GenAI/GenAIPanelTitleButton';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { dashboardEditActions } from '../edit-pane/shared';
import { VizPanelLinks } from '../scene/PanelLinks';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { useEditPaneInputAutoFocus } from '../scene/layouts-shared/utils';
import { isDashboardLayoutItem } from '../scene/types/DashboardLayoutItem';
import { vizPanelToPanel, transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../utils/utils';

export function getPanelFrameOptions(panel: VizPanel): OptionsPaneCategoryDescriptor {
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: t('dashboard-scene.get-panel-frame-options.descriptor.title.panel-options', 'Panel options'),
    id: 'Panel options',
    isOpenDefault: true,
  });

  const panelLinksObject = dashboardSceneGraph.getPanelLinks(panel);
  const links = panelLinksObject?.state.rawLinks ?? [];
  const dashboard = getDashboardSceneFor(panel);
  const layoutElement = panel.parent!;

  descriptor
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard-scene.get-panel-frame-options.title.title', 'Title'),
        id: uuidv4(),
        value: panel.state.title,
        popularRank: 1,
        render: function renderTitle(descriptor) {
          return <PanelFrameTitleInput id={descriptor.props.id} panel={panel} />;
        },
        addon: config.featureToggles.dashgpt && (
          <GenAIPanelTitleButton
            onGenerate={(title) => editPanelTitleAction(panel, title)}
            panel={vizPanelToPanel(panel)}
            dashboard={transformSceneToSaveModel(dashboard)}
          />
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard-scene.get-panel-frame-options.title.description', 'Description'),
        id: uuidv4(),
        value: panel.state.description,
        render: function renderDescription(descriptor) {
          return <PanelDescriptionTextArea id={descriptor.props.id} panel={panel} />;
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
        title: t('dashboard-scene.get-panel-frame-options.title.transparent-background', 'Transparent background'),
        id: uuidv4(),
        render: function renderTransparent(descriptor) {
          return <PanelBackgroundSwitch id={descriptor.props.id} panel={panel} />;
        },
      })
    )
    .addCategory(
      new OptionsPaneCategoryDescriptor({
        title: t('dashboard-scene.get-panel-frame-options.title.panel-links', 'Panel links'),
        id: 'Panel links',
        isOpenDefault: false,
        itemsCount: links?.length,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard-scene.get-panel-frame-options.title.panel-links', 'Panel links'),
          id: uuidv4(),
          render: () => <ScenePanelLinksEditor panelLinks={panelLinksObject ?? undefined} />,
        })
      )
    );

  if (isDashboardLayoutItem(layoutElement)) {
    layoutElement.getOptions?.().forEach((category) => descriptor.addCategory(category));
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

export function PanelFrameTitleInput({
  panel,
  isNewElement,
  id,
}: {
  panel: VizPanel;
  isNewElement?: boolean;
  id?: string;
}) {
  const { title } = panel.useState();
  const notInPanelEdit = panel.getPanelContext().app !== CoreApp.PanelEditor;
  const [prevTitle, setPrevTitle] = React.useState(panel.state.title);

  let ref = useEditPaneInputAutoFocus({
    autoFocus: notInPanelEdit && isNewElement,
  });

  return (
    <Input
      ref={ref}
      data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Title')}
      id={id}
      value={title}
      onFocus={() => setPrevTitle(title)}
      onBlur={() => editPanelTitleAction(panel, title, prevTitle)}
      // The full action (that can be undone) is done by setPanelTitle,
      // But to see changes in the input field, canvas and outline we change the real value here
      onChange={(e) => updatePanelTitleState(panel, e.currentTarget.value)}
    />
  );
}

export function PanelDescriptionTextArea({ panel, id }: { panel: VizPanel; id?: string }) {
  const { description } = panel.useState();
  const [prevDescription, setPrevDescription] = React.useState(panel.state.description);

  return (
    <TextArea
      id={id}
      value={description}
      onChange={(evt) => panel.setState({ description: evt.currentTarget.value })}
      onFocus={() => setPrevDescription(panel.state.description)}
      onBlur={() => {
        dashboardEditActions.edit({
          description: t('dashboard.edit-actions.panel-description', 'Change panel description'),
          source: panel,
          perform: () => panel.setState({ description: description }),
          undo: () => panel.setState({ description: prevDescription }),
        });
      }}
    />
  );
}

export function PanelBackgroundSwitch({ panel, id }: { panel: VizPanel; id?: string }) {
  const { displayMode = 'default' } = panel.useState();

  const onChange = () => {
    const newDisplayMode = displayMode === 'default' ? 'transparent' : 'default';

    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.panel-background', 'Change panel background'),
      source: panel,
      perform: () => panel.setState({ displayMode: newDisplayMode }),
      undo: () => panel.setState({ displayMode: displayMode }),
    });
  };

  return <Switch value={displayMode === 'transparent'} id={id} onChange={onChange} />;
}

function updatePanelTitleState(panel: VizPanel, title: string) {
  panel.setState({ title, hoverHeader: getUpdatedHoverHeader(title, panel.state.$timeRange) });
}

export function editPanelTitleAction(panel: VizPanel, title: string, prevTitle: string = panel.state.title) {
  if (title === prevTitle) {
    return;
  }

  dashboardEditActions.edit({
    description: t('dashboard.edit-actions.panel-title', 'Change panel title'),
    source: panel,
    perform: () => updatePanelTitleState(panel, title),
    undo: () => updatePanelTitleState(panel, prevTitle),
  });
}

export function getUpdatedHoverHeader(title: string, timeRange: SceneTimeRangeLike | undefined): boolean {
  if (title !== '') {
    return false;
  }

  if (timeRange instanceof PanelTimeRange && !timeRange.state.hideTimeOverride) {
    if (timeRange.state.timeFrom || timeRange.state.timeShift) {
      return false;
    }
  }

  return true;
}
