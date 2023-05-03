import { useDialog } from '@react-aria/dialog';
import { useOverlay } from '@react-aria/overlays';
import React, { createRef } from 'react';

import { Portal, VizTooltipContainer } from '@grafana/ui';

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
  const { dialogProps } = useDialog({}, ref);

  return (
    <>
      {ttip && ttip.layers && (
        <Portal>
          <VizTooltipContainer position={{ x: ttip.pageX, y: ttip.pageY }} offset={{ x: 10, y: 10 }} allowPointerEvents>
            <section ref={ref} {...overlayProps} {...dialogProps}>
              <ComplexDataHoverView layers={ttip.layers} isOpen={isOpen} onClose={onClose} />
            </section>
          </VizTooltipContainer>
        </Portal>
      )}
    </>
  );
};
