import React, { FC, useCallback, useMemo, useState } from 'react';

import { Stack } from '@grafana/experimental';
import { Button, Modal, ModalProps, Spinner } from '@grafana/ui';
import { Receiver, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../../types/amroutes';
import { AmRootRouteForm } from '../amroutes/AmRootRouteForm';
import { AmRoutesExpandedForm } from '../amroutes/AmRoutesExpandedForm';
import { useGetAmRouteReceiverWithGrafanaAppTypes } from '../receivers/grafanaAppReceivers/grafanaApp';

type ModalHook<T> = [JSX.Element, (item: T) => void, () => void];

const useAddPolicyModal = (
  receivers: Receiver[] = [],
  handleAdd: (route: Partial<FormAmRoute>, parentRoute: RouteWithID) => void,
  loading: boolean
): ModalHook<RouteWithID> => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [parentRoute, setParentRoute] = useState<RouteWithID>();
  const AmRouteReceivers = useGetAmRouteReceiverWithGrafanaAppTypes(receivers);

  const handleDismiss = useCallback(() => {
    setParentRoute(undefined);
    setShowModal(false);
  }, []);

  const handleShow = useCallback((parentRoute: RouteWithID) => {
    setParentRoute(parentRoute);
    setShowModal(true);
  }, []);

  const modalElement = useMemo(
    () =>
      loading ? (
        <UpdatingModal isOpen={showModal} />
      ) : (
        <Modal
          isOpen={showModal}
          onDismiss={handleDismiss}
          closeOnBackdropClick={true}
          closeOnEscape={true}
          title="Add notification policy"
        >
          <AmRoutesExpandedForm
            receivers={AmRouteReceivers}
            onSubmit={(newRoute) => parentRoute && handleAdd(newRoute, parentRoute)}
            actionButtons={
              <Modal.ButtonRow>
                <Button type="submit">Add policy</Button>
                <Button type="button" variant="secondary" onClick={handleDismiss}>
                  Cancel
                </Button>
              </Modal.ButtonRow>
            }
          />
        </Modal>
      ),
    [AmRouteReceivers, handleAdd, handleDismiss, loading, parentRoute, showModal]
  );

  return [modalElement, handleShow, handleDismiss];
};

const useEditPolicyModal = (
  alertManagerSourceName: string,
  receivers: Receiver[],
  handleSave: (route: Partial<FormAmRoute>) => void,
  loading: boolean
): ModalHook<RouteWithID> => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isDefaultPolicy, setIsDefaultPolicy] = useState<boolean>(false);
  const [route, setRoute] = useState<RouteWithID>();
  const AmRouteReceivers = useGetAmRouteReceiverWithGrafanaAppTypes(receivers);

  const handleDismiss = useCallback(() => {
    setRoute(undefined);
    setShowModal(false);
  }, []);

  const handleShow = useCallback((route: RouteWithID, isDefaultPolicy?: boolean) => {
    setIsDefaultPolicy(isDefaultPolicy ?? false);
    setRoute(route);
    setShowModal(true);
  }, []);

  const modalElement = useMemo(
    () =>
      loading ? (
        <UpdatingModal isOpen={showModal} />
      ) : (
        <Modal
          isOpen={showModal}
          onDismiss={handleDismiss}
          closeOnBackdropClick={true}
          closeOnEscape={true}
          title="Edit notification policy"
        >
          {isDefaultPolicy && route && (
            <AmRootRouteForm
              // TODO *sigh* this alertmanagersourcename should come from context or something
              // passing it down all the way here is a code smell
              alertManagerSourceName={alertManagerSourceName}
              onSubmit={handleSave}
              receivers={AmRouteReceivers}
              route={route}
              actionButtons={
                <Modal.ButtonRow>
                  <Button type="submit">Update default policy</Button>
                  <Button type="button" variant="secondary" onClick={handleDismiss}>
                    Cancel
                  </Button>
                </Modal.ButtonRow>
              }
            />
          )}
          {!isDefaultPolicy && (
            <AmRoutesExpandedForm
              receivers={AmRouteReceivers}
              route={route}
              onSubmit={handleSave}
              actionButtons={
                <Modal.ButtonRow>
                  <Button type="submit">Update policy</Button>
                  <Button type="button" variant="secondary" onClick={handleDismiss}>
                    Cancel
                  </Button>
                </Modal.ButtonRow>
              }
            />
          )}
        </Modal>
      ),
    [AmRouteReceivers, alertManagerSourceName, handleDismiss, handleSave, isDefaultPolicy, loading, route, showModal]
  );

  return [modalElement, handleShow, handleDismiss];
};

const useDeletePolicyModal = (handleDelete: (route: RouteWithID) => void, loading: boolean): ModalHook<RouteWithID> => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [route, setRoute] = useState<RouteWithID>();

  const handleDismiss = useCallback(() => {
    setRoute(undefined);
    setShowModal(false);
  }, [setRoute]);

  const handleShow = useCallback((route: RouteWithID) => {
    setRoute(route);
    setShowModal(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (route) {
      handleDelete(route);
    }
  }, [handleDelete, route]);

  const modalElement = useMemo(
    () =>
      loading ? (
        <UpdatingModal isOpen={showModal} />
      ) : (
        <Modal
          isOpen={showModal}
          onDismiss={handleDismiss}
          closeOnBackdropClick={true}
          closeOnEscape={true}
          title="Delete notification policy"
        >
          <p>Deleting this notification policy will permanently remove it.</p>
          <p>Are you sure you want to delete this policy?</p>

          <Modal.ButtonRow>
            <Button type="button" variant="destructive" onClick={handleSubmit}>
              Yes, delete policy
            </Button>
            <Button type="button" variant="secondary" onClick={handleDismiss}>
              Cancel
            </Button>
          </Modal.ButtonRow>
        </Modal>
      ),
    [handleDismiss, handleSubmit, loading, showModal]
  );

  return [modalElement, handleShow, handleDismiss];
};

const UpdatingModal: FC<Pick<ModalProps, 'isOpen'>> = ({ isOpen }) => (
  <Modal
    isOpen={isOpen}
    onDismiss={() => {}}
    closeOnBackdropClick={false}
    closeOnEscape={false}
    title={
      <Stack direction="row" alignItems="center" gap={0.5}>
        Updating... <Spinner inline />
      </Stack>
    }
  >
    Please wait while we update your notification policies.
  </Modal>
);

export { useAddPolicyModal, useDeletePolicyModal, useEditPolicyModal };
