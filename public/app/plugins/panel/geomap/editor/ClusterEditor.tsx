import { StandardEditorProps } from '@grafana/data';
import { Field, SliderValueEditor, Switch } from '@grafana/ui';
import React, { FC } from 'react';
import { defaultClusterConfig } from '../style/types';

export const ClusterEditor: FC<StandardEditorProps> = ({ value, onChange, context }) => {
  const onToggleCluster = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      enabled: event.currentTarget.checked,
    });
  };

  const onClusterDistanceChange = (distance: number | undefined) => {
    onChange({ ...value, distance: distance ?? defaultClusterConfig.distance });
  };

  return (
    <>
      <Field label={'Cluster enabled'}>
        <Switch value={value?.enabled ?? defaultClusterConfig.enabled} onChange={onToggleCluster} />
      </Field>
      {value?.enabled && (
        <Field label={'Cluster distance'}>
          <SliderValueEditor
            value={value?.distance ?? defaultClusterConfig.distance}
            onChange={onClusterDistanceChange}
            context={context}
            item={
              {
                settings: {
                  min: 0,
                  max: 100,
                  step: 1,
                },
              } as any
            }
          />
        </Field>
      )}
    </>
  );
};
