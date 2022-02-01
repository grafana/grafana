import { Portal, VizTooltipContainer } from '@grafana/ui';
import { FocusScope } from '@react-aria/focus';
import { useOverlay } from '@react-aria/overlays';
import React, { createRef, useEffect, useState } from 'react';
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
    console.log('CLICKED changed!!!', props);
    setSelectedTTip(ttip ? { ...ttip } : undefined);
    // Goal is a copy when clicked changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.clicked]);

  const onClose = () => {
    setSelectedTTip(undefined);
  };

  const ref = createRef<HTMLElement>();
  const { overlayProps } = useOverlay({ onClose, isDismissable: false, isOpen: !!selectedTTip }, ref);

  // pin the selected one
  if (selectedTTip) {
    ttip = selectedTTip;
  }

  return (
    <Portal>
      {ttip && ttip.layers && (
        <FocusScope contain autoFocus restoreFocus>
          <section ref={ref} {...overlayProps}>
            <VizTooltipContainer position={{ x: ttip.pageX, y: ttip.pageY }} offset={{ x: 10, y: 10 }}>
              <ComplexDataHoverView {...ttip} />
            </VizTooltipContainer>
          </section>
        </FocusScope>
      )}
    </Portal>
  );
};
