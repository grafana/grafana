import React, { useEffect, useState } from 'react';

import { textUtil } from '@grafana/data';
import { ConfirmModal, ConfirmModalProps, ModalsContext } from '@grafana/ui';
import { ModalsContextState } from '@grafana/ui/src/components/Modal/ModalsContext';
import { ShowConfirmModalEvent, ShowModalReactEvent } from 'app/types/events';

import appEvents from '../app_events';

export interface Props {
  children: React.ReactNode;
}

export function ModalsContextProvider(props: Props) {
  const [state, setState] = useState<ModalsContextState>({
    component: null,
    props: {},
    showModal: (component: React.ComponentType<any>, props: any) => {
      setState({ ...state, component, props });
    },
    hideModal: () => {
      setState({ ...state, component: null, props: {} });
    },
  });

  useEffect(() => {
    appEvents.subscribe(ShowModalReactEvent, ({ payload }) => {
      setState({
        ...state,
        component: payload.component,
        props: {
          ...payload.props,
          isOpen: true,
          onDismiss: state.hideModal,
        },
      });
    });
  });

  useEffect(() => {
    appEvents.subscribe(ShowConfirmModalEvent, (e) => {
      showConfirmModal(e, state, setState);
    });
  });

  return <ModalsContext.Provider value={state}>{props.children}</ModalsContext.Provider>;
}

function showConfirmModal(
  { payload }: ShowConfirmModalEvent,
  state: ModalsContextState,
  setState: (state: ModalsContextState) => void
) {
  const {
    confirmText,
    onConfirm = () => undefined,
    onDismiss,
    text2,
    altActionText,
    onAltAction,
    noText,
    text,
    text2htmlBind,
    yesText = 'Yes',
    icon,
    title = 'Confirm',
    yesButtonVariant,
  } = payload;

  const props: ConfirmModalProps = {
    confirmText: yesText,
    confirmButtonVariant: yesButtonVariant,
    confirmationText: confirmText,
    icon,
    title,
    body: text,
    description: text2 && text2htmlBind ? textUtil.sanitize(text2) : text2,
    isOpen: true,
    dismissText: noText,
    onConfirm: () => {
      onConfirm();
      state.hideModal();
    },
    onDismiss: () => {
      onDismiss?.();
      state.hideModal();
    },
    onAlternative: onAltAction
      ? () => {
          onAltAction();
          state.hideModal();
        }
      : undefined,
    alternativeText: altActionText,
  };

  setState({
    ...state,
    component: ConfirmModal,
    props,
  });
}
