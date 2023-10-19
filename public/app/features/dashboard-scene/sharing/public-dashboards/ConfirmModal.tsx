import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ConfirmModal as ConfirmModalComponent, ConfirmModalProps } from '@grafana/ui';

import { ModalSceneObjectLike } from '../types';

interface ConfirmModalState extends ConfirmModalProps, SceneObjectState {}

export class ConfirmModal extends SceneObjectBase<ConfirmModalState> implements ModalSceneObjectLike {
  static Component = ConfirmModalRenderer;

  constructor(state: ConfirmModalState) {
    super({
      confirmVariant: 'destructive',
      dismissText: 'Cancel',
      dismissVariant: 'secondary',
      icon: 'exclamation-triangle',
      confirmButtonVariant: 'destructive',
      ...state,
    });
  }

  onDismiss() {}
}

function ConfirmModalRenderer({ model }: SceneComponentProps<ConfirmModal>) {
  const props = model.useState();
  return <ConfirmModalComponent {...props} />;
}
