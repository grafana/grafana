import React, { useEffect } from 'react';
import Joyride, { STATUS, CallBackProps } from 'react-joyride';

import { colors, useTheme2 } from '@grafana/ui';
import store from 'app/core/store';

import { SelectedView } from './types';

type Props = {
  selectedView: SelectedView;
  setSelectedView: (view: SelectedView) => void;
  showTour: boolean;
  setShowTour: (showTour: boolean) => void;
};

const FlameGraphTour = ({ selectedView, setSelectedView, showTour, setShowTour }: Props) => {
  const theme = useTheme2();
  const TOUR_COMPLETED_KEY = 'grafana.datasources.profiling-tour-completed';
  const SCROLLBAR_CLASS = 'main .scrollbar-view';

  useEffect(() => {
    const isTourCompleted = store.exists(TOUR_COMPLETED_KEY);
    if (!isTourCompleted) {
      setShowTour(true);
      const scrollbarElem = document.querySelector<HTMLElement>(SCROLLBAR_CLASS);
      if (scrollbarElem) {
        scrollbarElem.style.overflow = 'initial';
      }
    }
  }, [setShowTour]);

  const joyrideCallback = (callbackProps: CallBackProps) => {
    const { index, lifecycle, status } = callbackProps;

    // Prevents view jumping when scrolling between tour elements
    // (if user has already scrolled down the page).
    // Also ensures profile selector is in view (which is the first tour item).
    if (index === 0) {
      document.querySelector('.page-toolbar')?.scrollIntoView();
    }

    // Fixes react-joyride issue where it's injecting overflow initial into parent
    // but does not remove it when it's no longer needed i.e. when no tooltip shown.
    // https://github.com/gilbarbara/react-joyride/issues/563
    const scrollbarElem = document.querySelector<HTMLElement>(SCROLLBAR_CLASS);
    if (scrollbarElem) {
      scrollbarElem.style.overflow = lifecycle === 'tooltip' ? 'initial' : 'scroll';
    }

    if (showTour && selectedView !== SelectedView.Both) {
      setSelectedView(SelectedView.Both);
    }

    if (status === STATUS.FINISHED) {
      store.set(TOUR_COMPLETED_KEY, true);
      setShowTour(false);
    }
  };

  const joyrideSteps = [
    {
      title: 'Profiling Tour',
      target: '.query-editor-row',
      content: (
        <>
          <p>The query editor allows you to;</p>
          <ul style={{ textAlign: 'left', padding: '0 34px' }}>
            <li>select a profile to query,</li>
            <li>add labels to your query e.g. pod or namespace,</li>
            <li>set options such as query type or labels to group your metric query.</li>
          </ul>
        </>
      ),
    },
    {
      title: 'Top Table',
      target: 'div[data-testid="topTable"]',
      content: TOP_TABLE_TOUR_CONTENT,
    },
    {
      title: 'Flame Graph',
      target: 'canvas[data-testid="flameGraph"]',
      content: FLAME_GRAPH_TOUR_CONTENT,
    },
  ];

  return (
    <>
      {showTour && (
        <Joyride
          callback={joyrideCallback}
          continuous={true}
          disableCloseOnEsc={true}
          disableOverlayClose={true}
          floaterProps={{ placement: 'top' }}
          hideCloseButton={true}
          run={showTour}
          showProgress={true}
          steps={joyrideSteps}
          styles={{
            options: {
              primaryColor: colors[4],
              zIndex: theme.zIndex.tooltip,
            },
          }}
        />
      )}
    </>
  );
};

export const TOP_TABLE_TOUR_CONTENT =
  'The top table allows you to easily view and sort by functions that are consuming the most resources in your application.';
export const FLAME_GRAPH_TOUR_CONTENT =
  'The flame graph visualizes how resources are consumed in your application and allows you to drill down into specific function calls.';

export default FlameGraphTour;
