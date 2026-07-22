import React from 'react';

import { CoreApp, type FieldConfigSource, type PanelPluginVisualizationSuggestion } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { DataLinksInlineEditor, Input, TextArea, Switch, Stack, Label, Field } from '@grafana/ui';
import { GenAIPanelDescriptionButton } from 'app/features/dashboard/components/GenAI/GenAIPanelDescriptionButton';
import { GenAIPanelTitleButton } from 'app/features/dashboard/components/GenAI/GenAIPanelTitleButton';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { dashboardEditActions } from '../edit-pane/shared';
import { type VizPanelLinks } from '../scene/PanelLinks';
import { useEditPaneInputAutoFocus } from '../scene/layouts-shared/utils';
import { isDashboardLayoutItem } from '../scene/types/DashboardLayoutItem';
import { vizPanelToPanel, transformSceneToSaveModel } from '../serialization/transformSceneToSaveModel';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../utils/utils';

import { PanelStylesSection } from './PanelStylesSection';

export function createPresetApplyHandler(panel: VizPanel) {
  return function onApplyPreset(preset: PanelPluginVisualizationSuggestion, prevFieldConfig: FieldConfigSource) {
    const prevOptions = panel.state.options;
    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.panel-preset', 'Apply panel preset'),
      source: panel,
      perform: () => {
        if (preset.fieldConfig) {
          const { defaults, overrides } = panel.state.fieldConfig;
          const presetDefaults = preset.fieldConfig.defaults;
          panel.onFieldConfigChange(
            {
              defaults: {
                ...defaults,
                ...presetDefaults,
                custom: { ...defaults.custom, ...presetDefaults?.custom },
                ...(presetDefaults?.color && { color: presetDefaults.color }),
                ...(presetDefaults?.thresholds && { thresholds: presetDefaults.thresholds }),
              },
              overrides,
            },
            true
          );
        }
        if (preset.options) {
          panel.onOptionsChange({ ...panel.state.options, ...preset.options }, true);
        }
      },
      undo: () => {
        panel.onFieldConfigChange(prevFieldConfig, true);
        if (preset.options) {
          panel.onOptionsChange(prevOptions, true);
        }
      },
    });
  };
}

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
        addon: (
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
        id: 'panel-frame-options-description',
        value: panel.state.description,
        skipField: true,
        render: function renderDescription(descriptor) {
          return <PanelDescriptionTextArea id={descriptor.props.id} panel={panel} />;
        },
        addon: (
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

export function getPanelStylesOptions(panel: VizPanel): OptionsPaneCategoryDescriptor | undefined {
  return new OptionsPaneCategoryDescriptor({
    title: t('dashboard-scene.get-panel-frame-options.title.panel-styles', 'Panel styles'),
    id: 'panel-styles',
    isOpenDefault: true,
    customRender: () => (
      <PanelStylesSection key="panel-styles" panel={panel} onApplyPreset={createPresetApplyHandler(panel)} />
    ),
  });
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
  const { description, subtitle } = panel.useState();
  const [prevDescription, setPrevDescription] = React.useState(description ?? subtitle ?? '');
  let propName: 'description' | 'subtitle' = description ? 'description' : 'subtitle';

  const onCommitDescriptionChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.panel-description', 'panel description change'),
      source: panel,
      perform: () => panel.setState({ [propName]: description }),
      undo: () => panel.setState({ [propName]: prevDescription }),
    });
  };

  const onToggleSubtitle = (evt: React.ChangeEvent<HTMLInputElement>) => {
    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.panel-description', 'panel description change'),
      source: panel,
      perform: () => {
        if (propName === 'description') {
          panel.setState({ subtitle: description });
          panel.setState({ description: undefined });
        } else {
          panel.setState({ description: subtitle });
          panel.setState({ subtitle: undefined });
        }
      },
      undo: () => {
        if (propName === 'description') {
          panel.setState({ subtitle: undefined });
          panel.setState({ description: description });
        } else {
          panel.setState({ subtitle: subtitle });
          panel.setState({ description: undefined });
        }
      },
    });
  };

  const label = (
    <Stack direction="row" justifyContent="space-between">
      <Label htmlFor={id}>
        <Trans i18nKey="dashboard.viz-panel.options.description">Description</Trans>
      </Label>
      <Stack>
        <Label htmlFor="panel-subtitle-switch">
          <Trans i18nKey="dashboard.viz-panel.options.description-as-subtitle">As subtitle</Trans>
        </Label>
        <Switch
          value={!!subtitle}
          id="panel-subtitle-switch"
          onChange={onToggleSubtitle}
          label={t('dashboard.viz-panel.options.description-as-subtitle', 'As subtitle')}
          data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('subtitle-switch')}
        />
      </Stack>
    </Stack>
  );

  return (
    <>
      {/* eslint-disable-next-line @grafana/require-no-margin */}
      <Field
        label={label}
        data-testid={selectors.components.PanelEditor.OptionsPane.fieldLabel('panel-options Description')}
      >
        <TextArea
          id={id}
          value={subtitle ?? description}
          onChange={(evt) => panel.setState({ description: evt.currentTarget.value })}
          onFocus={() => setPrevDescription(subtitle ?? description ?? '')}
          onBlur={onCommitDescriptionChange}
        />
      </Field>
    </>
  );
}

export function PanelBackgroundSwitch({ panel, id }: { panel: VizPanel; id?: string }) {
  const { displayMode = 'default' } = panel.useState();

  const onChange = () => {
    const newDisplayMode = displayMode === 'default' ? 'transparent' : 'default';

    dashboardEditActions.edit({
      description: t('dashboard.edit-actions.panel-background', 'panel background change'),
      source: panel,
      perform: () => panel.setState({ displayMode: newDisplayMode }),
      undo: () => panel.setState({ displayMode: displayMode }),
    });
  };

  return <Switch value={displayMode === 'transparent'} id={id} onChange={onChange} />;
}

function updatePanelTitleState(panel: VizPanel, title: string) {
  getDashboardSceneFor(panel).updatePanelTitle(panel, title);
}

export function editPanelTitleAction(panel: VizPanel, title: string, prevTitle: string = panel.state.title) {
  if (title === prevTitle) {
    return;
  }

  dashboardEditActions.edit({
    description: t('dashboard.edit-actions.panel-title', 'panel title change'),
    source: panel,
    perform: () => updatePanelTitleState(panel, title),
    undo: () => updatePanelTitleState(panel, prevTitle),
  });
}
