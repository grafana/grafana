import React from 'react';
import { Container } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';
import { DropResult } from 'react-beautiful-dnd';

import { GeomapPanelOptions } from '../../types';
import { GeomapInstanceState } from '../../GeomapPanel';
import { AddLayerButton } from './AddLayerButton';
import { LayerList } from './LayerList';

type LayersEditorProps = StandardEditorProps<any, any, GeomapPanelOptions, GeomapInstanceState>;

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

  return (
    <>
      <Container>
        <AddLayerButton actions={actions} />
      </Container>
      <br />

      <LayerList layers={layers} onDragEnd={onDragEnd} selected={selected} actions={actions} />
    </>
  );
};
