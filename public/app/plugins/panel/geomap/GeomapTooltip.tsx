import { useDialog } from '@react-aria/dialog';
import { useOverlay } from '@react-aria/overlays';
import { createRef } from 'react';

import { t } from '@grafana/i18n';
import { Portal, VizTooltipContainer } from '@grafana/ui';
import { ComplexDataHoverView } from 'app/features/visualization/data-hover/ComplexDataHoverView';

import { type GeomapHoverPayload } from './event';

interface Props {
  ttip?: GeomapHoverPayload;
  isOpen: boolean;
  onClose: () => void;
}

export const GeomapTooltip = ({ ttip, onClose, isOpen }: Props) => {
  const ref = createRef<HTMLElement>();
  const { overlayProps } = useOverlay({ onClose, isDismissable: true, isOpen }, ref);
  const { dialogProps } = useDialog({ 'aria-label': t('geomap.tooltip.dialog-label', 'Map tooltip') }, ref);

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
