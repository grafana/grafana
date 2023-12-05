import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';
import { usePopperTooltip } from 'react-popper-tooltip';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { TutorialTooltip } from './TutorialTooltip';
import { nextStep } from './slice';
import { resolveRequiredActions, waitForElement } from './tutorialProvider.utils';
import type { Step } from './types';

type TutorialOverlayProps = {
  currentStep: number;
  step: Step;
};

const spotlightOffset = 0;

export const TutorialOverlay = ({ currentStep, step }: TutorialOverlayProps) => {
  const dispatch = useDispatch();
  const [showTooltip, setShowTooltip] = useState(false);
  const styles = useStyles2(getStyles);
  const [spotlightStyles, setSpotlightStyles] = useState({});
  const [canInteract, setCanInteract] = useState(false);

  const popper = usePopperTooltip({
    visible: showTooltip,
    placement: step.placement,
    defaultVisible: false,
  });
  const { getArrowProps, getTooltipProps, setTooltipRef, setTriggerRef, triggerRef } = popper;

  const advance = useCallback(() => {
    setShowTooltip(false);
    dispatch(nextStep());
  }, [dispatch]);

  useEffect(() => {
    if (!step) {
      setShowTooltip(false);
    }
  }, [step]);

  useEffect(() => {
    let setStyles: any;
    let mouseMoveCallback: any;
    let scrollParent: Element | null;

    if (step && triggerRef) {
      waitForElement(step.target).then((element) => {
        setStyles = () =>
          new Promise((resolve) => {
            setSpotlightStyles(getSpotlightStyles(element));

            requestAnimationFrame(() => {
              resolve(true);
            });
          });

        mouseMoveCallback = (e: MouseEvent) => {
          if (triggerRef) {
            setCanInteract(isMouseOverSpotlight(e, triggerRef));
          }
        };

        document.addEventListener('mousemove', mouseMoveCallback);
        scrollParent = element.closest('.scrollbar-view');
        setStyles().then(() => {
          if (step.requiredActions) {
            resolveRequiredActions(step.requiredActions).then(() => {
              advance();
            });
          }
          setShowTooltip(true);
        });
        scrollParent?.addEventListener('scroll', setStyles);
      });
    }

    return () => {
      scrollParent?.removeEventListener('scroll', setStyles);
      document.removeEventListener('mousemove', mouseMoveCallback);
    };
  }, [advance, currentStep, step, triggerRef]);

  return (
    <>
      <div className={styles.container} id="tutorial" style={{ pointerEvents: canInteract ? `none` : `auto` }}>
        <div className={styles.spotlight} style={spotlightStyles} ref={setTriggerRef} />
      </div>
      {showTooltip && (
        <TutorialTooltip
          advance={advance}
          getArrowProps={getArrowProps}
          getTooltipProps={getTooltipProps}
          ref={setTooltipRef}
          step={step}
        />
      )}
    </>
  );
};

function getSpotlightStyles(node: Element) {
  const { top, left, width, height } = node.getBoundingClientRect();
  const leftOffset = left - spotlightOffset;
  const topOffset = top - spotlightOffset;

  return {
    left: `${leftOffset}px`,
    top: `${topOffset}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
}

function isMouseOverSpotlight(mouseEvent: MouseEvent, spotlightElement: HTMLElement) {
  const { height, left, top, width } = spotlightElement.getBoundingClientRect();

  const offsetY = mouseEvent.pageY;
  const offsetX = mouseEvent.pageX;
  const inSpotlightHeight = offsetY >= top && offsetY <= top + height;
  const inSpotlightWidth = offsetX >= left && offsetX <= left + width;
  const inSpotlight = inSpotlightWidth && inSpotlightHeight;

  return inSpotlight;
}

// TODO: LEFT / TOP TRANSITION BUT NOT WHEN SCROLLING
const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    height: '100%',
    width: '100%',
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1058,
    mixBlendMode: 'hard-light',
  }),
  spotlight: css({
    backgroundColor: `#939393`,
    position: `absolute`,
    boxSizing: `content-box`,
    borderRadius: theme.shape.radius.default,
    transition: [`width`, `height`].map((prop) => `${prop} 0.2s ease-in-out`).join(', '),
    padding: spotlightOffset,
  }),
});
