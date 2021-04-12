import React, { useEffect, useRef, useState } from 'react';
import { AnnotationQuery, DataSourceApi } from '@grafana/data';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';

export interface Props {
  annotation: AnnotationQuery;
  datasource: DataSourceApi;
  onChange: (annotation: AnnotationQuery) => void;
}

export const AngularEditorLoader: React.FC<Props> = React.memo(({ annotation, datasource, onChange }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [angularComponent, setAngularComponent] = useState<AngularComponent | null>(null);

  useEffect(() => {
    return () => {
      if (angularComponent) {
        angularComponent.destroy();
      }
    };
  }, [angularComponent]);

  useEffect(() => {
    if (ref.current) {
      const loader = getAngularLoader();
      const template = `<plugin-component ng-if="!ctrl.currentDatasource.annotations" type="annotations-query-ctrl"> </plugin-component>`;
      const scopeProps = {
        ctrl: {
          currentDatasource: datasource,
          currentAnnotation: annotation,
        },
      };

      const component = loader.load(ref.current, scopeProps, template);
      component.digest();
      component.getScope().$watch(() => {
        onChange({
          ...annotation,
        });
      });

      setAngularComponent(component);
    }
    // specifying annotation or onChange causes angular error `Cannot read property '$$nextSibling' of null`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, datasource]);

  return <div ref={ref} />;
});
AngularEditorLoader.displayName = 'AngularEditorLoader';
