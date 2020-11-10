import React, { FunctionComponent, useEffect, useState } from 'react';
import { LegacyForms } from '@grafana/ui';
import { EventBusExtended } from '@grafana/data';
import { CoreEvents } from 'app/types';
const { Switch } = LegacyForms;

interface Props {
  events: EventBusExtended;
  annotations: any[];
  onAnnotationChanged: (annotation: any) => void;
}

export const Annotations: FunctionComponent<Props> = ({ events, annotations, onAnnotationChanged }) => {
  const [visibleAnnotations, setVisibleAnnotations] = useState<any>([]);
  useEffect(() => {
    setVisibleAnnotations(annotations.filter(annotation => annotation.hide !== true));
  }, [annotations]);

  useEffect(() => {
    const handler = () => {
      setVisibleAnnotations(annotations.filter(annotation => annotation.hide !== true));
    };
    events.on(CoreEvents.submenuVisibilityChanged, handler);
    return () => events.off(CoreEvents.submenuVisibilityChanged, handler);
  }, []);

  if (visibleAnnotations.length === 0) {
    return null;
  }

  return (
    <>
      {visibleAnnotations.map((annotation: any) => {
        return (
          <div
            key={annotation.name}
            className={annotation.enable ? 'submenu-item' : 'submenu-item annotation-disabled'}
          >
            <Switch
              label={annotation.name}
              className="gf-form"
              checked={annotation.enable}
              onChange={() => onAnnotationChanged(annotation)}
            />
          </div>
        );
      })}
    </>
  );
};
