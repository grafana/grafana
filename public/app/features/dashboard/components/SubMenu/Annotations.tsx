import React, { FunctionComponent, useEffect, useState } from 'react';
import { AnnotationQuery } from '@grafana/data';
import { InlineField, InlineSwitch } from '@grafana/ui';

interface Props {
  annotations: AnnotationQuery[];
  onAnnotationChanged: (annotation: any) => void;
}

export const Annotations: FunctionComponent<Props> = ({ annotations, onAnnotationChanged }) => {
  const [visibleAnnotations, setVisibleAnnotations] = useState<any>([]);
  useEffect(() => {
    setVisibleAnnotations(annotations.filter((annotation) => annotation.hide !== true));
  }, [annotations]);

  if (visibleAnnotations.length === 0) {
    return null;
  }

  return (
    <>
      {visibleAnnotations.map((annotation: any) => {
        return (
          <div key={annotation.name} className={'submenu-item'}>
            <InlineField label={annotation.name}>
              <InlineSwitch value={annotation.enable} onChange={() => onAnnotationChanged(annotation)} />
            </InlineField>
          </div>
        );
      })}
    </>
  );
};
