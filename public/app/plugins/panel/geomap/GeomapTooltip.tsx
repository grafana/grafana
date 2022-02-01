import React, { createRef, useEffect, useState } from 'react';
import { VizTooltipContainer } from '@grafana/ui';
import { useOverlay } from '@react-aria/overlays';

import { ComplexDataHoverView } from './components/ComplexDataHoverView';
import { GeomapHoverPayload } from './event';

interface Props {
  ttip?: GeomapHoverPayload;
  clicked?: number;
}

export const GeomapTooltip = (props: Props) => {
  let { ttip } = props; // changes with each hover

  // copy of the payload when hovering
  const [selectedTTip, setSelectedTTip] = useState<GeomapHoverPayload>();

  useEffect(() => {
    setSelectedTTip(ttip ? { ...ttip } : undefined);
    // Goal is a copy when clicked changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.clicked]);

  const onClose = () => {
    setSelectedTTip(undefined);
  };

  const ref = createRef<HTMLElement>();
  const { overlayProps } = useOverlay({ onClose, isDismissable: true, isOpen: !!selectedTTip }, ref);

  // pin the selected one
  if (selectedTTip) {
    ttip = selectedTTip;
  }

  return (
    <>
      {ttip && ttip.layers && (
        <section ref={ref} {...overlayProps}>
          <VizTooltipContainer position={{ x: ttip.pageX, y: ttip.pageY }} offset={{ x: 10, y: 10 }} allowPointerEvents>
            <ComplexDataHoverView {...ttip} />
          </VizTooltipContainer>
        </section>
      )}
    </>
  );
};
