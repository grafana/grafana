import React from 'react';
import { DropResult } from 'react-beautiful-dnd';

import { StandardEditorProps } from '@grafana/data';
import { Container } from '@grafana/ui';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';
import { LayerDragDropList } from 'app/core/components/Layers/LayerDragDropList';

import { getLayersOptions } from '../layers/registry';
import { PanelOptions, MapLayerState, GeomapInstanceState } from '../types';

type LayersEditorProps = StandardEditorProps<unknown, unknown, PanelOptions, GeomapInstanceState>;

export const LayersEditor = (props: LayersEditorProps) => {
  const { layers, selected, actions } = props.context.instanceState ?? {};
  if (!layers || !actions) {
    return <div>No layers?</div>;
  }

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const { layers, actions } = props.context.instanceState ?? {};
    if (!layers || !actions) {
      return;
    }

    // account for the reverse order and offset (0 is baselayer)
    const count = layers.length - 1;
    const src = (result.source.index - count) * -1;
    const dst = (result.destination.index - count) * -1;

    actions.reorder(src, dst);
  };

  const onSelect = (element: MapLayerState<unknown>) => {
    actions.selectLayer(element.options.name);
  };

  const onDelete = (element: MapLayerState<unknown>) => {
    actions.deleteLayer(element.options.name);
  };

  const getLayerInfo = (element: MapLayerState<unknown>) => {
    return element.options.type;
  };

  const onNameChange = (element: MapLayerState<unknown>, name: string) => {
    element.onChange({ ...element.options, name });
  };

  const selection = selected ? [layers[selected]?.getName()] : [];

  return (
    <>
      <Container>
        <AddLayerButton
          onChange={(v) => actions.addlayer(v.value!)}
          options={getLayersOptions(false).options}
          label={'Add layer'}
        />
      </Container>
      <br />

      <LayerDragDropList
        layers={layers}
        showActions={() => layers.length > 2} // 2 because base layer is not counted!
        getLayerInfo={getLayerInfo}
        onDragEnd={onDragEnd}
        onSelect={onSelect}
        onDelete={onDelete}
        selection={selection}
        excludeBaseLayer
        onNameChange={onNameChange}
        verifyLayerNameUniqueness={actions.canRename}
      />
    </>
  );
};
