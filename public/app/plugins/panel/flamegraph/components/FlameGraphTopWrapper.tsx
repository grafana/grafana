import { FlamegraphRenderer } from '@pyroscope/flamegraph';
import React from 'react';
import '@pyroscope/flamegraph/dist/index.css';

import { CoreApp, DataFrame } from '@grafana/data';
import { config } from '@grafana/runtime';

import FlameGraphContainer from './FlameGraphContainer';

type Props = {
  data?: DataFrame;
  app: CoreApp;
  // Height for flame graph when not used in explore.
  // This needs to be different to explore flame graph height as we
  // use panels with user adjustable heights in dashboards etc.
  flameGraphHeight?: number;
};
const SimpleTree = {
  version: 1,
  flamebearer: {
    names: [
      'total',
      'runtime.mcall',
      'runtime.park_m',
      'runtime.schedule',
      'runtime.resetspinning',
      'runtime.wakep',
      'runtime.startm',
      'runtime.notewakeup',
      'runtime.semawakeup',
      'runtime.pthread_cond_signal',
      'runtime.findrunnable',
      'runtime.netpoll',
      'runtime.kevent',
      'runtime.main',
      'main.main',
      'github.com/pyroscope-io/client/pyroscope.TagWrapper',
      'runtime/pprof.Do',
      'github.com/pyroscope-io/client/pyroscope.TagWrapper.func1',
      'main.main.func1',
      'main.slowFunction',
      'main.slowFunction.func1',
      'main.work',
      'runtime.asyncPreempt',
      'main.fastFunction',
      'main.fastFunction.func1',
    ],
    levels: [
      [0, 609, 0, 0],
      [0, 606, 0, 13, 0, 3, 0, 1],
      [0, 606, 0, 14, 0, 3, 0, 2],
      [0, 606, 0, 15, 0, 3, 0, 3],
      [0, 606, 0, 16, 0, 1, 0, 10, 0, 2, 0, 4],
      [0, 606, 0, 17, 0, 1, 0, 11, 0, 2, 0, 5],
      [0, 606, 0, 18, 0, 1, 1, 12, 0, 2, 0, 6],
      [0, 100, 0, 23, 0, 506, 0, 19, 1, 2, 0, 7],
      [0, 100, 0, 15, 0, 506, 0, 16, 1, 2, 0, 8],
      [0, 100, 0, 16, 0, 506, 0, 20, 1, 2, 2, 9],
      [0, 100, 0, 17, 0, 506, 493, 21],
      [0, 100, 0, 24, 493, 13, 13, 22],
      [0, 100, 97, 21],
      [97, 3, 3, 22],
    ],
    numTicks: 609,
    maxSelf: 493,
  },
  metadata: {
    appName: 'simple.golang.app.cpu',
    name: 'simple.golang.app.cpu 2022-09-06T12:16:31Z',
    startTime: 1662466591,
    endTime: 1662470191,
    query: 'simple.golang.app.cpu{}',
    maxNodes: 1024,
    format: 'single' as const,
    sampleRate: 100,
    spyName: 'gospy' as const,
    units: 'samples' as const,
  },
  timeline: {
    startTime: 1662466590,
    samples: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 610, 0,
    ],
    durationDelta: 10,
  },
};

export const FlameGraphTopWrapper = (props: Props) => {
  if (config.featureToggles.pyroscopeFlameGraph) {
    return <FlamegraphRenderer profile={SimpleTree} onlyDisplay="flamegraph" showToolbar={false} />;
  }

  return <FlameGraphContainer data={props.data} app={props.app} />;
};
