import { PanelPluginMeta } from '@grafana/data';

import { PanelTypeCard } from './PanelTypeCard';

interface Props {
  isCurrent: boolean;
  plugin: PanelPluginMeta;
  onSelect: (withModKey?: boolean) => void;
  disabled: boolean;
}

export const VizTypePickerPlugin = ({ isCurrent, plugin, onSelect, disabled }: Props) => {
  return (
    <PanelTypeCard
      title={plugin.name}
      plugin={plugin}
      description={plugin.info.description}
      onSelect={onSelect}
      isCurrent={isCurrent}
      disabled={disabled}
      showBadge={true}
    />
  );
};

VizTypePickerPlugin.displayName = 'VizTypePickerPlugin';
