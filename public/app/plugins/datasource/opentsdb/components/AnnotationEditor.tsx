import React, { useState } from 'react';

import { QueryEditorProps } from '@grafana/data';
import { InlineFormLabel, Input, InlineSwitch } from '@grafana/ui';

import OpenTsDatasource from '../datasource';
import { OpenTsdbQuery, OpenTsdbOptions } from '../types';

export const AnnotationEditor = (props: QueryEditorProps<OpenTsDatasource, OpenTsdbQuery, OpenTsdbOptions>) => {
  const { query, onChange } = props;
  const [target, setTarget] = useState<string>(query.target ?? '');
  const [isGlobal, setIsGlobal] = useState<boolean>(query.isGlobal ?? false);

  const updateValue = <K extends keyof OpenTsdbQuery, V extends OpenTsdbQuery[K]>(key: K, val: V) => {
    onChange({
      ...query,
      [key]: val,
      fromAnnotations: true,
    });
  };

  const updateIsGlobal = (isGlobal: boolean) => {
    isGlobal = !isGlobal;
    setIsGlobal(isGlobal);
    updateValue('isGlobal', isGlobal);
  };

  return (
    <div className="gf-form-group">
      <div className="gf-form">
        <InlineFormLabel width={12}>OpenTSDB metrics query</InlineFormLabel>
        <Input
          value={target}
          onChange={(e) => setTarget(e.currentTarget.value ?? '')}
          onBlur={() => updateValue('target', target)}
          placeholder="events.eventname"
        />
      </div>
      <div className="gf-form">
        <InlineFormLabel width={12}>Show Global Annotations?</InlineFormLabel>
        <InlineSwitch value={isGlobal} onChange={(e) => updateIsGlobal(isGlobal)} />
      </div>
    </div>
  );
};
