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

  const onMinClusterDistanceChange = (minDistance: number | undefined) => {
    onChange({ ...value, minDistance: minDistance ?? defaultClusterConfig.minDistance });
  };

  return (
    <>
      <Field label={'Cluster enabled'}>
        <Switch value={value?.enabled ?? defaultClusterConfig.enabled} onChange={onToggleCluster} />
      </Field>
      {value?.enabled && (
        <>
          <Field label={'Cluster distance'} description={''}>
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
          <Field label={'Minimum distance'} description={'Minimum distance between clusters'}>
            <SliderValueEditor
              value={value?.minDistance ?? defaultClusterConfig.minDistance}
              onChange={onMinClusterDistanceChange}
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
        </>
      )}
    </>
  );
};
