import React, { useEffect, useState } from 'react';

import { AnnotationQuery, DataQuery, EventBus } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { AnnotationPicker } from './AnnotationPicker';

interface Props {
  events: EventBus;
  annotations: AnnotationQuery[];
  onAnnotationChanged: (annotation: AnnotationQuery<DataQuery>) => void;
}

export const Annotations = ({ annotations, onAnnotationChanged, events }: Props) => {
  const [visibleAnnotations, setVisibleAnnotations] = useState<AnnotationQuery[]>([]);
  useEffect(() => {
    setVisibleAnnotations(annotations.filter((annotation) => annotation.hide !== true));
  }, [annotations]);

  if (visibleAnnotations.length === 0) {
    return null;
  }

  return (
    <div data-testId={selectors.pages.Dashboard.SubMenu.Annotations.annotationsWrapper}>
      {visibleAnnotations.map((annotation) => (
        <AnnotationPicker
          events={events}
          annotation={annotation}
          onEnabledChanged={onAnnotationChanged}
          key={annotation.name}
        />
      ))}
    </div>
  );
};
