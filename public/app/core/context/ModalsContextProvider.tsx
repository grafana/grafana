import React, { useEffect, useMemo, useState } from 'react';

import { textUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ConfirmModal, ConfirmModalProps, ModalsContext } from '@grafana/ui';
import { ModalsContextState } from '@grafana/ui/src/components/Modal/ModalsContext';
import { ShowConfirmModalEvent, ShowModalReactEvent } from 'app/types/events';

import appEvents from '../app_events';

export interface Props {
  children: React.ReactNode;
}

interface StateType {
  component: React.ComponentType<any> | null;
  props: any;
}

/**
 * Implements the ModalsContext state logic (not used that much, only needed in edge cases)
 * Also implements the handling of the events ShowModalReactEvent and ShowConfirmModalEvent.
 */
export function ModalsContextProvider(props: Props) {
  const [state, setState] = useState<StateType>({
    component: null,
    props: {},
  });

  const contextValue: ModalsContextState = useMemo(() => {
    return {
      component: state.component,
      props: state.props,
      showModal: (component: React.ComponentType<any>, props: any) => {
        setState({ component, props });
      },
      hideModal: () => {
        setState({ component: null, props: {} });
      },
    };
  }, [state]);

  useEffect(() => {
    appEvents.subscribe(ShowModalReactEvent, ({ payload }) => {
      setState({
        component: payload.component,
        props: {
          ...payload.props,
          isOpen: true,
          onDismiss: () => setState({ component: null, props: {} }),
        },
      });
    });

    appEvents.subscribe(ShowConfirmModalEvent, (e) => {
      showConfirmModal(e, setState);
    });

    // In case there is a link in the modal/drawer we need to hide it when location changes
    let prevPath = '';
    locationService.getHistory().listen((location) => {
      if (location.pathname !== prevPath) {
        setState({ component: null, props: {} });
      }
      prevPath = location.pathname;
    });
  }, []);

  return <ModalsContext.Provider value={contextValue}>{props.children}</ModalsContext.Provider>;
}

function showConfirmModal({ payload }: ShowConfirmModalEvent, setState: (state: StateType) => void) {
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

  const hideModal = () => setState({ component: null, props: {} });

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
      hideModal();
    },
    onDismiss: () => {
      onDismiss?.();
      hideModal();
    },
    onAlternative: onAltAction
      ? () => {
          onAltAction();
          hideModal();
        }
      : undefined,
    alternativeText: altActionText,
  };

  setState({ component: ConfirmModal, props });
}
