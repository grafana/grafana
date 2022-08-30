import { DataHoverClearEvent } from '@grafana/data/src';

import { GeomapPanel } from '../GeomapPanel';

export function setTooltipListeners(this: GeomapPanel) {
  // Tooltip listener
  this.map?.on('singleclick', this.pointerClickListener);
  this.map?.on('pointermove', this.pointerMoveListener);
  this.map?.getViewport().addEventListener('mouseout', (evt) => {
    this.props.eventBus.publish(new DataHoverClearEvent());
  });
}
