import { css } from '@emotion/css';
import React, { PureComponent, useRef } from 'react';

import { PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { IconButton, Spinner, stylesFactory, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { Step } from './components/Step';
import { getSteps } from './steps';
import { SetupStep } from './types';

interface State {
  checksDone: boolean;
  currentStep: number;
  steps: SetupStep[];
}

export class GettingStarted extends PureComponent<PanelProps, State> {
  state = {
    checksDone: false,
    currentStep: 0,
    steps: getSteps(),
  };

  async componentDidMount() {
    const { steps } = this.state;

    const checkedStepsPromises: Array<Promise<SetupStep>> = steps.map(async (step: SetupStep) => {
      const checkedCardsPromises = step.cards.map(async (card) => {
        return card.check().then((passed) => {
          return { ...card, done: false };
        });
      });
      const checkedCards = await Promise.all(checkedCardsPromises);
      return {
        ...step,
        done: checkedCards.every((c) => c.done),
        cards: checkedCards,
      };
    });

    const checkedSteps = await Promise.all(checkedStepsPromises);

    this.setState({
      currentStep: !checkedSteps[0].done ? 0 : 1,
      steps: checkedSteps,
      checksDone: true,
    });
  }

  onForwardClick = () => {
    this.setState((prevState) => ({
      currentStep: prevState.currentStep + 1,
    }));
  };

  onPreviousClick = () => {
    this.setState((prevState) => ({
      currentStep: prevState.currentStep - 1,
    }));
  };

  dismiss = () => {
    const { id } = this.props;
    const dashboard = getDashboardSrv().getCurrent();
    const panel = dashboard?.getPanelById(id);

    dashboard?.removePanel(panel!);

    backendSrv.put('/api/user/helpflags/1', undefined, { showSuccessAlert: false }).then((res) => {
      contextSrv.user.helpFlags1 = res.helpFlags1;
    });
  };

  render() {
    const { checksDone, steps } = this.state;
    const styles = getStyles();

    // TODO: restore "Remove this panel" link / button

    return (
      <div className={styles.container}>
        {!checksDone ? (
          <div className={styles.loading}>
            <div className={styles.loadingText}>Checking completed setup steps</div>
            <Spinner size="xl" inline />
          </div>
        ) : (
          <StepCarousel steps={steps} />
        )}
      </div>
    );
  }
}

function getElementWidth(el: HTMLElement): number {
  const baseWidth = el.clientWidth;
  const computedStyles = window.getComputedStyle(el);
  const pageWidth =
    baseWidth - parseFloat(computedStyles.paddingLeft || '0') - parseFloat(computedStyles.paddingRight || '0');

  return pageWidth;
}

/**
 * Scrolls an element by a given percentage of its width
 * @param element Element to scroll
 * @param scrollBy Percentage of the element's width to scroll. Positive values scroll right, negative values scroll left
 */
function scrollElement(element: HTMLElement, scrollBy: number) {
  const scrollByPx = getElementWidth(element) * scrollBy;

  element.scrollTo({
    left: element.scrollLeft + scrollByPx,
    behavior: 'smooth',
  });
}

function StepCarousel({ steps }: { steps: SetupStep[] }) {
  const styles = useStyles2(getStyles);

  const carouselRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = React.useState(0);

  const calcScrollProgress = (el: HTMLDivElement) => {
    const { scrollWidth, offsetWidth, scrollLeft } = el;
    const scrollableWidth = scrollWidth - offsetWidth;
    setScrollProgress(scrollLeft / scrollableWidth);
  };

  React.useEffect(() => {
    carouselRef.current && calcScrollProgress(carouselRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carouselRef.current]);

  const handleScroll = (ev: React.UIEvent<HTMLDivElement>) => {
    calcScrollProgress(ev.target as HTMLDivElement);
  };

  return (
    <div className={styles.carouselWrapper}>
      <IconButton
        className={styles.prevButton}
        variant="secondary"
        name="angle-left"
        tooltip="Previous"
        disabled={scrollProgress === 0}
        onClick={() => carouselRef.current && scrollElement(carouselRef.current, -1)}
        size="xl"
      />
      <IconButton
        className={styles.nextButton}
        variant="secondary"
        name="angle-right"
        tooltip="Next"
        disabled={scrollProgress === 1}
        onClick={() => carouselRef.current && scrollElement(carouselRef.current, 1)}
        size="xl"
      />

      <div className={styles.stepCarousel} ref={carouselRef} onScroll={handleScroll}>
        {steps.map((step, index) => {
          return (
            <div key={index} className={styles.step}>
              <Step step={step} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const getStyles = stylesFactory(() => {
  const theme = config.theme2;

  const nextPrevSpacing = 1;
  const nextPrevSize = 4; // xl button grid size
  const nextPrevGutter = nextPrevSize + nextPrevSpacing * 2;

  const buttonBase = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 2,

    ['&:disabled']: {
      opacity: 0,
      pointerEvents: 'none',
    },
  } as const;

  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundSize: 'cover',
    }),
    carouselWrapper: css({
      position: 'relative',
    }),
    nextButton: css(buttonBase, {
      right: theme.spacing(0.5 + nextPrevSpacing),
    }),
    prevButton: css(buttonBase, {
      left: theme.spacing(0.5 + nextPrevSpacing),
    }),
    stepCarousel: css({
      position: 'relative',
      zIndex: 1,
      overflowX: 'auto',
      display: 'flex',
      flexWrap: 'nowrap',
      scrollSnapType: 'x proximity',
      padding: theme.spacing(2, 0),
    }),
    step: css({
      scrollSnapAlign: 'start',
      flexShrink: 0,
      paddingLeft: theme.spacing(nextPrevGutter),

      display: 'flex',
      '& > div': {
        flex: 1,
      },

      // Make last step full width so when it scrolls it can snap to the start of the container
      '&:last-of-type': {
        minWidth: '100%',
        // paddingRight: theme.spacing(nextPrevGutter),
      },

      '&:first-of-type': {},
    }),
    dismiss: css({
      alignSelf: 'flex-end',
      textDecoration: 'underline',
      marginBottom: theme.spacing(1),
    }),
    loading: css({
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    }),
    loadingText: css({
      marginRight: theme.spacing(1),
    }),
  };
});
