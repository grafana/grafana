import { t } from '@grafana/i18n';
import { Input } from '@grafana/ui';
import { LibraryPanelInformation } from 'app/features/library-panels/components/LibraryPanelInfo/LibraryPanelInfo';

import { isPanelModelLibraryPanel } from '../../../library-panels/guard';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OptionPaneRenderProps } from './types';

export function getLibraryPanelOptionsCategory(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor {
  const { panel, onPanelConfigChange, dashboard } = props;
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: t(
      'dashboard.get-library-panel-options-category.descriptor.title.library-panel-options',
      'Library panel options'
    ),
    id: 'Library panel options',
    isOpenDefault: true,
  });

  if (isPanelModelLibraryPanel(panel)) {
    descriptor
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.get-library-panel-options-category.title.name', 'Name'),
          id: 'library-panel-name',
          value: panel.libraryPanel.name,
          popularRank: 1,
          render: function renderName(descriptor) {
            return (
              <Input
                id={descriptor.props.id}
                defaultValue={panel.libraryPanel.name}
                onBlur={(e) =>
                  onPanelConfigChange('libraryPanel', { ...panel.libraryPanel, name: e.currentTarget.value })
                }
              />
            );
          },
        })
      )
      .addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.get-library-panel-options-category.title.information', 'Information'),
          id: 'library-panel-information',
          render: function renderLibraryPanelInformation() {
            return <LibraryPanelInformation panel={panel} formatDate={dashboard.formatDate} />;
          },
        })
      );
  }

  return descriptor;
}
