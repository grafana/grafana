import React from 'react';

import { config } from '@grafana/runtime';

import { AnnotationsPlugin2 } from './AnnotationsPlugin2';
import { AnnotationsPlugin2Cluster } from './AnnotationsPlugin2Cluster';

export const AnnotationsPlugin = (props: React.ComponentProps<typeof AnnotationsPlugin2Cluster>) => {
  if (config.featureToggles.annotationsClustering) {
    return <AnnotationsPlugin2Cluster {...props} />;
  }
  const { options, ...rest } = props;
  return <AnnotationsPlugin2 {...rest} multiLane={options?.multiLane} />;
};
