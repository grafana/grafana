import { css } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import { usePopperTooltip } from 'react-popper-tooltip';
import { connect, ConnectedProps } from 'react-redux';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { StoreState, useDispatch } from 'app/types';

import { TutorialTooltip } from './TutorialTooltip';
import { nextStep } from './slice';
import { resolveRequiredActions, waitForElement } from './tutorialProvider.utils';

const spotlightOffset = 0;
const STARTING_ZINDEX = 1061;
const MODAL_OPEN_ZINDEX = 1000;

type TutorialOverlayProps = ConnectedProps<typeof connector> & {
  modalOpen: boolean;
};

const TutorialOverlayComponent = ({
  modalOpen,
  availableTutorials,
  currentTutorialId,
  currentStepIndex,
  stepTransition,
}: TutorialOverlayProps) => {
  const dispatch = useDispatch();
  const [dynamicZIndex, setDynamicZIndex] = useState(STARTING_ZINDEX);
  const [showTooltip, setShowTooltip] = useState(false);
  const styles = useStyles2((theme) => getStyles(theme, dynamicZIndex));
  const [spotlightStyles, setSpotlightStyles] = useState({});
  const [canInteract, setCanInteract] = useState(false);
  const previousLocationCoords = useRef(``);
  const currentTutorial = availableTutorials.find((t) => t.id === currentTutorialId);
  const step = currentStepIndex !== null && currentTutorial ? currentTutorial.steps[currentStepIndex] : null;
  const isTransitioning = stepTransition === `transitioning`;

  const popper = usePopperTooltip({
    visible: showTooltip,
    placement: step ? step.placement : undefined,
    defaultVisible: false,
  });
  const { getTooltipProps, setTooltipRef, setTriggerRef, triggerRef } = popper;

  useEffect(() => {
    const resetZIndex = dynamicZIndex;
    setDynamicZIndex(modalOpen ? MODAL_OPEN_ZINDEX : resetZIndex);

    return () => {
      setDynamicZIndex(resetZIndex);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  useEffect(() => {
    if (previousLocationCoords.current && !isTransitioning && currentTutorial) {
      setShowTooltip(false);
    }
  }, [currentTutorial, isTransitioning]);

  useEffect(() => {
    let setStyles: any;
    let mouseMoveCallback: any;
    let scrollParent: Element | null;
    let transitionend: (e: TransitionEvent) => void;

    if (step && triggerRef) {
      waitForElement(step.target).then((element) => {
        const newCoords = getStringCoords(element);
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

        if (previousLocationCoords.current === newCoords) {
          setShowTooltip(true);
          previousLocationCoords.current = newCoords;
        }

        transitionend = (e) => {
          // TODO: if there are multiple steps on the same element
          // with no transition the tooltip won't show
          if ([`width`, `height`, `top`, `left`].includes(e.propertyName)) {
            setShowTooltip(true);
            previousLocationCoords.current = newCoords;
          }
        };

        triggerRef.addEventListener(`transitionend`, transitionend);

        document.addEventListener('mousemove', mouseMoveCallback);
        scrollParent = element.closest('.scrollbar-view');
        setStyles().then(() => {
          if (step.requiredActions) {
            resolveRequiredActions(step.requiredActions).then(() => {
              dispatch(nextStep());
            });
          }

          if (!previousLocationCoords.current) {
            setShowTooltip(true);
            previousLocationCoords.current = newCoords;
          }
        });
        scrollParent?.addEventListener('scroll', setStyles);
      });
    }

    return () => {
      scrollParent?.removeEventListener('scroll', setStyles);
      document.removeEventListener('mousemove', mouseMoveCallback);
      triggerRef?.removeEventListener(`transitionend`, transitionend);
    };
  }, [dispatch, step, triggerRef]);

  return (
    <>
      <div className={styles.container} id="tutorial" style={{ pointerEvents: canInteract ? `none` : `auto` }}>
        <div className={styles.spotlight} style={spotlightStyles} ref={setTriggerRef} />
      </div>
      {showTooltip && (
        <div ref={setTooltipRef} {...getTooltipProps()} className={styles.instructions}>
          <TutorialTooltip />
        </div>
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
const getStyles = (theme: GrafanaTheme2, zIndex: number) => ({
  container: css({
    height: '100%',
    width: '100%',
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: zIndex,
    mixBlendMode: 'hard-light',
  }),
  spotlight: css({
    backgroundColor: `gray`,
    position: `absolute`,
    boxSizing: `content-box`,
    borderRadius: theme.shape.radius.default,
    transition: [`width`, `height`, `left`, `top`].map((prop) => `${prop} 0.2s ease-in-out`).join(', '),
    padding: spotlightOffset,
  }),
  instructions: css({
    display: `flex`,
    flexDirection: `column`,
    gap: theme.spacing(2),
    zIndex: zIndex + 1,
    width: `300px`,
    backgroundColor: theme.colors.background.primary,
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
  }),
});

function getStringCoords(element: Element) {
  const { width, height, x, y } = element.getBoundingClientRect();

  return [width, height, x, y].join(`,`);
}

const mapStateToProps = (state: StoreState) => {
  return {
    ...state.tutorials,
  };
};

const connector = connect(mapStateToProps);

export const TutorialOverlay = connector(TutorialOverlayComponent);
