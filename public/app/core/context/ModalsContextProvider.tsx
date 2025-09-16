import { useEffect, useMemo, useState } from 'react';
import * as React from 'react';

import { textUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ConfirmModal, ConfirmModalProps, ModalsContext } from '@grafana/ui';
import { ModalsContextState } from '@grafana/ui/internal';
import { ShowConfirmModalEvent, ShowModalReactEvent } from 'app/types/events';

import appEvents from '../app_events';

export interface Props {
  children: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface StateType<TProps = any> {
  component: React.ComponentType<TProps> | null;
  props: TProps;
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
    function showModal<TProps = {}>(component: React.ComponentType<TProps>, props: TProps) {
      setState({ component, props });
    }

    function hideModal() {
      setState({ component: null, props: {} });
    }

    return {
      component: state.component,
      props: {
        ...state.props,
        isOpen: true,
        onDismiss: hideModal,
      },
      showModal,
      hideModal,
    };
  }, [state]);

  useEffect(() => {
    appEvents.subscribe(ShowModalReactEvent, ({ payload }) => {
      setState({
        component: payload.component,
        props: payload.props,
      });
    });

    appEvents.subscribe(ShowConfirmModalEvent, (e) => {
      showConfirmModal(e, setState);
    });

    // Dismiss the modal when the route changes (if there's a link in the modal)
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
