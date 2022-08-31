import { DataHoverClearEvent } from '@grafana/data/src';

import { GeomapPanel } from '../GeomapPanel';

export const setTooltipListeners = (panel: GeomapPanel) => {
  // Tooltip listener
  panel.map?.on('singleclick', panel.pointerClickListener);
  panel.map?.on('pointermove', panel.pointerMoveListener);
  panel.map?.getViewport().addEventListener('mouseout', (evt: MouseEvent) => {
    panel.props.eventBus.publish(new DataHoverClearEvent());
  });
};
