import React, { useCallback, useState } from 'react';

import { Modal } from '@grafana/ui';

import { NetworkGraph, Props as NetWorkGraphProps } from './NetworkGraph';
import { GraphEdge, GraphNode } from './utils';

interface NetworkGraphModalApi {
  showModal: () => void;
}

interface OwnProps extends Pick<NetWorkGraphProps, 'direction'> {
  show: boolean;
  title: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  children: (api: NetworkGraphModalApi) => JSX.Element;
}

interface ConnectedProps {}

interface DispatchProps {}

type Props = OwnProps & ConnectedProps & DispatchProps;

export function NetworkGraphModal({ edges, nodes, show: propsShow, title, children }: Props): JSX.Element {
  const [show, setShow] = useState(propsShow);
  const showModal = useCallback(() => setShow(true), [setShow]);
  const onClose = useCallback(() => setShow(false), [setShow]);

  return (
    <>
      <Modal
        isOpen={show}
        title={title}
        icon="info-circle"
        iconTooltip="The graph can be moved, zoomed in, and zoomed out."
        onClickBackdrop={onClose}
        onDismiss={onClose}
      >
        <NetworkGraph nodes={nodes} edges={edges} />
      </Modal>
      {children({ showModal })}
    </>
  );
}
