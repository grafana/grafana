import { v4 as uuidv4 } from 'uuid';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { DataLinksInlineEditor, Input, RadioButtonGroup, Select, Switch, TextArea } from '@grafana/ui';
import { getPanelLinksVariableSuggestions } from 'app/features/panel/panellinks/link_srv';

import { GenAIPanelDescriptionButton } from '../GenAI/GenAIPanelDescriptionButton';
import { GenAIPanelTitleButton } from '../GenAI/GenAIPanelTitleButton';
import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OptionPaneRenderProps } from './types';

export function getPanelFrameCategory(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor {
  const { dashboard, panel, onPanelConfigChange } = props;
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: t('dashboard.get-panel-frame-category.descriptor.title.panel-options', 'Panel options'),
    id: 'Panel options',
    isOpenDefault: true,
  });

  const panelFrameTitleId = uuidv4();
  const descriptionId = uuidv4();

  const setPanelTitle = (title: string) => {
    const input = document.getElementById(panelFrameTitleId);
    if (input instanceof HTMLInputElement) {
      input.value = title;
      onPanelConfigChange('title', title);
    }
  };

  const setPanelDescription = (description: string) => {
    const input = document.getElementById(descriptionId);
    if (input instanceof HTMLTextAreaElement) {
      input.value = description;
      onPanelConfigChange('description', description);
    }
  };

  return descriptor
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.get-panel-frame-category.title.title', 'Title'),
        id: panelFrameTitleId,
        value: panel.title,
        popularRank: 1,
        render: function renderTitle(descriptor) {
          return (
            <Input
              data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Title')}
              id={descriptor.props.id}
              defaultValue={panel.title}
              onBlur={(e) => onPanelConfigChange('title', e.currentTarget.value)}
            />
          );
        },
        addon: config.featureToggles.dashgpt && (
          <GenAIPanelTitleButton
            onGenerate={setPanelTitle}
            panel={panel.getSaveModel()}
            dashboard={dashboard.getSaveModelClone()}
          />
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.get-panel-frame-category.title.description', 'Description'),
        id: descriptionId,
        description: panel.description,
        value: panel.description,
        render: function renderDescription(descriptor) {
          return (
            <TextArea
              data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Description')}
              id={descriptor.props.id}
              defaultValue={panel.description}
              onBlur={(e) => onPanelConfigChange('description', e.currentTarget.value)}
            />
          );
        },
        addon: config.featureToggles.dashgpt && (
          <GenAIPanelDescriptionButton onGenerate={setPanelDescription} panel={panel.getSaveModel()} />
        ),
      })
    )
    .addItem(
      new OptionsPaneItemDescriptor({
        title: t('dashboard.get-panel-frame-category.title.transparent-background', 'Transparent background'),
        id: uuidv4(),
        render: function renderTransparent(descriptor) {
          return (
            <Switch
              data-testid={selectors.components.PanelEditor.OptionsPane.fieldInput('Transparent background')}
              value={panel.transparent}
              id={descriptor.props.id}
              onChange={(e) => onPanelConfigChange('transparent', e.currentTarget.checked)}
            />
          );
        },
      })
    )
    .addCategory(
      new OptionsPaneCategoryDescriptor({
        title: t('dashboard.get-panel-frame-category.title.panel-links', 'Panel links'),
        id: 'Panel links',
        isOpenDefault: false,
        itemsCount: panel.links?.length,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.get-panel-frame-category.title.panel-links', 'Panel links'),
          id: uuidv4(),
          render: function renderLinks() {
            return (
              <DataLinksInlineEditor
                links={panel.links}
                onChange={(links) => onPanelConfigChange('links', links)}
                getSuggestions={getPanelLinksVariableSuggestions}
                data={[]}
              />
            );
          },
        })
      )
    )
    .addCategory(
      new OptionsPaneCategoryDescriptor({
        title: t('dashboard.get-panel-frame-category.title.repeat-options', 'Repeat options'),
        id: 'Repeat options',
        isOpenDefault: false,
      })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.get-panel-frame-category.title.repeat-by-variable', 'Repeat by variable'),
            id: uuidv4(),
            description:
              'Repeat this panel for each value in the selected variable. This is not visible while in edit mode. You need to go back to dashboard and then update the variable or reload the dashboard.',
            render: function renderRepeatOptions(descriptor) {
              return (
                <RepeatRowSelect
                  id={descriptor.props.id}
                  repeat={panel.repeat}
                  onChange={(value?: string) => {
                    onPanelConfigChange('repeat', value);
                  }}
                />
              );
            },
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.get-panel-frame-category.title.repeat-direction', 'Repeat direction'),
            showIf: () => !!panel.repeat,
            render: function renderRepeatOptions() {
              const directionOptions = [
                {
                  label: t('dashboard.get-panel-frame-category.direction-options.label.horizontal', 'Horizontal'),
                  value: 'h',
                },
                {
                  label: t('dashboard.get-panel-frame-category.direction-options.label.vertical', 'Vertical'),
                  value: 'v',
                },
              ];

              return (
                <RadioButtonGroup
                  options={directionOptions}
                  value={panel.repeatDirection || 'h'}
                  onChange={(value) => onPanelConfigChange('repeatDirection', value)}
                />
              );
            },
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.get-panel-frame-category.title.max-per-row', 'Max per row'),
            id: uuidv4(),
            showIf: () => Boolean(panel.repeat && panel.repeatDirection === 'h'),
            render: function renderOption(descriptor) {
              const maxPerRowOptions = [2, 3, 4, 6, 8, 12].map((value) => ({ label: value.toString(), value }));
              return (
                <Select
                  id={descriptor.props.id}
                  options={maxPerRowOptions}
                  value={panel.maxPerRow}
                  onChange={(value) => onPanelConfigChange('maxPerRow', value.value)}
                />
              );
            },
          })
        )
    );
}
