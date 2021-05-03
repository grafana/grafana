import React, { MouseEventHandler } from 'react';
import { PanelPluginMeta } from '@grafana/data';
import { PanelTypeCard } from './PanelTypeCard';

interface Props {
  isCurrent: boolean;
  plugin: PanelPluginMeta;
  onClick: MouseEventHandler<HTMLDivElement>;
  disabled: boolean;
}

export const VizTypePickerPlugin: React.FC<Props> = ({ isCurrent, plugin, onClick, disabled }) => {
  return (
    <PanelTypeCard
      title={plugin.name}
      plugin={plugin}
      onClick={onClick}
      isCurrent={isCurrent}
      disabled={disabled}
      showBadge={true}
    />
  );
};

VizTypePickerPlugin.displayName = 'VizTypePickerPlugin';
