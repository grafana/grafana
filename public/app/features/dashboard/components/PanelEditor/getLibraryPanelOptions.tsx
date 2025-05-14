import { Input } from '@grafana/ui';
import { LibraryPanelInformation } from 'app/features/library-panels/components/LibraryPanelInfo/LibraryPanelInfo';

import { isPanelModelLibraryPanel } from '../../../library-panels/guard';

import { OptionsPaneCategoryDescriptor } from './OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from './OptionsPaneItemDescriptor';
import { OptionPaneRenderProps } from './types';

export function getLibraryPanelOptionsCategory(props: OptionPaneRenderProps): OptionsPaneCategoryDescriptor {
  const { panel, onPanelConfigChange, dashboard } = props;
  const descriptor = new OptionsPaneCategoryDescriptor({
    title: 'Library panel options',
    id: 'Library panel options',
    isOpenDefault: true,
  });

  if (isPanelModelLibraryPanel(panel)) {
    descriptor
      .addItem(
        new OptionsPaneItemDescriptor({
          title: 'Name',
          value: panel.libraryPanel.name,
          popularRank: 1,
          render: function renderName() {
            return (
              <Input
                id="LibraryPanelFrameName"
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
          title: 'Information',
          render: function renderLibraryPanelInformation() {
            return <LibraryPanelInformation panel={panel} formatDate={dashboard.formatDate} />;
          },
        })
      );
  }

  return descriptor;
}
