import React, { createRef } from 'react';
import { VizTooltipContainer } from '@grafana/ui';
import { useOverlay } from '@react-aria/overlays';

import { ComplexDataHoverView } from './components/ComplexDataHoverView';
import { GeomapHoverPayload } from './event';

interface Props {
  ttip?: GeomapHoverPayload;
  isOpen: boolean;
  onClose: () => void;
}

export const GeomapTooltip = ({ ttip, onClose, isOpen }: Props) => {
  const ref = createRef<HTMLElement>();
  const { overlayProps } = useOverlay({ onClose, isDismissable: true, isOpen }, ref);

  return (
    <>
      {ttip && ttip.layers && (
        <VizTooltipContainer position={{ x: ttip.pageX, y: ttip.pageY }} offset={{ x: 10, y: 10 }} allowPointerEvents>
          <section ref={ref} {...overlayProps}>
            <ComplexDataHoverView {...ttip} isOpen={isOpen} onClose={onClose} />
          </section>
        </VizTooltipContainer>
      )}
    </>
  );
};
