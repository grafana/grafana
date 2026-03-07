import React, { useMemo } from 'react';

import { CoreApp } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneTimeRangeLike, VizPanel } from '@grafana/scenes';
import { DataLinksInlineEditor, Switch } from '@grafana/ui';
import { GenAIPanelDescriptionButton } from 'app/features/dashboard/components/GenAI/GenAIPanelDescriptionButton';
import { GenAIPanelTitleButton } from 'app/features/dashboard/components/GenAI/GenAIPanelTitleButton';
import { GenAITextArea } from 'app/features/dashboard/components/GenAI/GenAITextArea';
import { GenAITextInput } from 'app/features/dashboard/components/GenAI/GenAITextInput';
import {
  buildAssistantDescriptionPrompt,
  buildAssistantTitlePrompt,
} from 'app/features/dashboard/components/GenAI/assistantContext';
import { LLMFallbackAddon, useIsAssistantAvailable } from 'app/features/dashboard/components/GenAI/hooks';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { dashboardEditActions } from '../edit-pane/shared';
import { VizPanelLinks } from '../scene/PanelLinks';
import { useEditPaneInputAutoFocus } from '../scene/layouts-shared/utils';
import { PanelTimeRange } from '../scene/panel-timerange/PanelTimeRange';
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
        id: 'panel-frame-options-title',
        value: panel.state.title,
        popularRank: 1,
        render: function renderTitle(descriptor) {
          return <PanelFrameTitleInput id={descriptor.props.id} panel={panel} />;
        },
        addon: config.featureToggles.dashgpt && (
          <LLMFallbackAddon>
            <GenAIPanelTitleButton
              onGenerate={(title) => editPanelTitleAction(panel, title)}
              panel={vizPanelToPanel(panel)}
              dashboard={transformSceneToSaveModel(dashboard)}
            />
          </LLMFallbackAddon>
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard-scene.get-panel-frame-options.title.description', 'Description'),
        id: 'panel-frame-options-description',
        value: panel.state.description,
        render: function renderDescription(descriptor) {
          return <PanelDescriptionTextArea id={descriptor.props.id} panel={panel} />;
        },
        addon: config.featureToggles.dashgpt && (
          <LLMFallbackAddon>
            <GenAIPanelDescriptionButton
              onGenerate={(description) => panel.setState({ description })}
              panel={vizPanelToPanel(panel)}
            />
          </LLMFallbackAddon>
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard-scene.get-panel-frame-options.title.transparent-background', 'Transparent background'),
        id: 'panel-frame-options-transparent-bg',
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
          id: 'panel-frame-options-panel-links',
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
  const isAssistantAvailable = useIsAssistantAvailable();
  const notInPanelEdit = panel.getPanelContext().app !== CoreApp.PanelEditor;
  const [prevTitle, setPrevTitle] = React.useState(panel.state.title);

  const ref = useEditPaneInputAutoFocus({
    autoFocus: notInPanelEdit && isNewElement,
  });

  const isDefaultTitle = !title || title === t('dashboard.new-panel-title', 'New panel');

  const prompt = useMemo(() => {
    const dashboard = getDashboardSceneFor(panel);
    return buildAssistantTitlePrompt(vizPanelToPanel(panel), transformSceneToSaveModel(dashboard));
  }, [panel]);

  return (
    <GenAITextInput
      data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Title')}
      value={isAssistantAvailable && isDefaultTitle ? '' : title}
      onChange={(val) => updatePanelTitleState(panel, val)}
      onComplete={(val) => editPanelTitleAction(panel, val)}
      onFocus={() => setPrevTitle(title)}
      onBlur={() => editPanelTitleAction(panel, title, prevTitle)}
      systemPrompt={prompt.systemPrompt}
      userPrompt={prompt.prompt}
      autoGenerate={isAssistantAvailable && isDefaultTitle}
      id={id}
      inputRef={ref}
    />
  );
}

export function PanelDescriptionTextArea({ panel, id }: { panel: VizPanel; id?: string }) {
  const { description } = panel.useState();
  const [prevDescription, setPrevDescription] = React.useState(panel.state.description);

  const prompt = useMemo(() => {
    const dashboard = getDashboardSceneFor(panel);
    return buildAssistantDescriptionPrompt(vizPanelToPanel(panel), transformSceneToSaveModel(dashboard));
  }, [panel]);

  return (
    <GenAITextArea
      value={description ?? ''}
      onChange={(val) => panel.setState({ description: val })}
      onComplete={(val) => {
        dashboardEditActions.edit({
          description: t('dashboard.edit-actions.panel-description', 'Change panel description'),
          source: panel,
          perform: () => panel.setState({ description: val }),
          undo: () => panel.setState({ description: prevDescription }),
        });
      }}
      onFocus={() => setPrevDescription(panel.state.description)}
      onBlur={() => {
        dashboardEditActions.edit({
          description: t('dashboard.edit-actions.panel-description', 'Change panel description'),
          source: panel,
          perform: () => panel.setState({ description: description }),
          undo: () => panel.setState({ description: prevDescription }),
        });
      }}
      systemPrompt={prompt.systemPrompt}
      userPrompt={prompt.prompt}
      autoGenerate={!description}
      id={id}
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
