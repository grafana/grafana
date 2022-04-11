import React, { createRef } from 'react';
import { VizTooltipContainer } from '@grafana/ui';
import { useDialog } from '@react-aria/dialog';
import { useOverlay } from '@react-aria/overlays';

import { ComplexDataHoverView } from '../components/ComplexDataHoverView';
import { HeatmapHoverPayload } from '../types';

interface Props {
  ttip?: HeatmapHoverPayload;
  isOpen: boolean;
  onClose: () => void;
}

export const ExemplarTooltip = ({ ttip, onClose, isOpen }: Props) => {
  const ref = createRef<HTMLElement>();
  const { overlayProps } = useOverlay({ onClose, isDismissable: true, isOpen }, ref);
  const { dialogProps } = useDialog({}, ref);

  return (
    <>
      {ttip && ttip.layers && (
        <VizTooltipContainer
          position={{ x: ttip.hover.pageX, y: ttip.hover.pageY }}
          offset={{ x: 10, y: 10 }}
          allowPointerEvents
        >
          <section ref={ref} {...overlayProps} {...dialogProps}>
            <ComplexDataHoverView layers={ttip.layers} isOpen={isOpen} onClose={onClose} />
          </section>
        </VizTooltipContainer>
      )}
    </>
  );
};
