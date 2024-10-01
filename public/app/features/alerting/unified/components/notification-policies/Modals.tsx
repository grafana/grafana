import { groupBy } from 'lodash';
import { FC, useCallback, useMemo, useState } from 'react';

import { Button, Icon, Modal, ModalProps, Spinner, Stack } from '@grafana/ui';
import { AlertmanagerGroup, AlertState, ObjectMatcher, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../../types/amroutes';
import { MatcherFormatter } from '../../utils/matchers';
import { InsertPosition } from '../../utils/routeTree';
import { AlertGroup } from '../alert-groups/AlertGroup';

import { AlertGroupsSummary } from './AlertGroupsSummary';
import { AmRootRouteForm } from './EditDefaultPolicyForm';
import { AmRoutesExpandedForm } from './EditNotificationPolicyForm';
import { Matchers } from './Matchers';

type ModalHook<T = undefined> = [JSX.Element, (item: T) => void, () => void];
type AddModalHook<T = undefined> = [JSX.Element, (item: T, position: InsertPosition) => void, () => void];
type EditModalHook = [JSX.Element, (item: RouteWithID, isDefaultRoute?: boolean) => void, () => void];

const useAddPolicyModal = (
  handleAdd: (route: Partial<FormAmRoute>, referenceRoute: RouteWithID, position: InsertPosition) => void,
  loading: boolean
): AddModalHook<RouteWithID> => {
  const [showModal, setShowModal] = useState(false);
  const [insertPosition, setInsertPosition] = useState<InsertPosition | undefined>(undefined);
  const [referenceRoute, setReferenceRoute] = useState<RouteWithID>();

  const handleDismiss = useCallback(() => {
    setReferenceRoute(undefined);
    setInsertPosition(undefined);
    setShowModal(false);
  }, []);

  const handleShow = useCallback((referenceRoute: RouteWithID, position: InsertPosition) => {
    setReferenceRoute(referenceRoute);
    setInsertPosition(position);
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
            defaults={{
              groupBy: referenceRoute?.group_by,
            }}
            onSubmit={(newRoute) => {
              if (referenceRoute && insertPosition) {
                handleAdd(newRoute, referenceRoute, insertPosition);
              }
            }}
            actionButtons={
              <Modal.ButtonRow>
                <Button type="button" variant="secondary" onClick={handleDismiss} fill="outline">
                  Cancel
                </Button>
                <Button type="submit">Save policy</Button>
              </Modal.ButtonRow>
            }
          />
        </Modal>
      ),
    [handleAdd, handleDismiss, insertPosition, loading, referenceRoute, showModal]
  );

  return [modalElement, handleShow, handleDismiss];
};

const useEditPolicyModal = (
  alertManagerSourceName: string,
  handleSave: (route: Partial<FormAmRoute>) => void,
  loading: boolean
): EditModalHook => {
  const [showModal, setShowModal] = useState(false);
  const [isDefaultPolicy, setIsDefaultPolicy] = useState(false);
  const [route, setRoute] = useState<RouteWithID>();

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
              route={route}
              actionButtons={
                <Modal.ButtonRow>
                  <Button type="button" variant="secondary" onClick={handleDismiss} fill="outline">
                    Cancel
                  </Button>
                  <Button type="submit">Update default policy</Button>
                </Modal.ButtonRow>
              }
            />
          )}
          {!isDefaultPolicy && (
            <AmRoutesExpandedForm
              route={route}
              onSubmit={handleSave}
              actionButtons={
                <Modal.ButtonRow>
                  <Button type="button" variant="secondary" onClick={handleDismiss} fill="outline">
                    Cancel
                  </Button>
                  <Button type="submit">Update policy</Button>
                </Modal.ButtonRow>
              }
            />
          )}
        </Modal>
      ),
    [alertManagerSourceName, handleDismiss, handleSave, isDefaultPolicy, loading, route, showModal]
  );

  return [modalElement, handleShow, handleDismiss];
};

const useDeletePolicyModal = (handleDelete: (route: RouteWithID) => void, loading: boolean): ModalHook<RouteWithID> => {
  const [showModal, setShowModal] = useState(false);
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

const useAlertGroupsModal = (
  alertManagerSourceName: string
): [JSX.Element, (alertGroups: AlertmanagerGroup[], matchers?: ObjectMatcher[]) => void, () => void] => {
  const [showModal, setShowModal] = useState(false);
  const [alertGroups, setAlertGroups] = useState<AlertmanagerGroup[]>([]);
  const [matchers, setMatchers] = useState<ObjectMatcher[]>([]);
  const [formatter, setFormatter] = useState<MatcherFormatter>('default');

  const handleDismiss = useCallback(() => {
    setShowModal(false);
    setAlertGroups([]);
    setMatchers([]);
  }, []);

  const handleShow = useCallback(
    (alertGroups: AlertmanagerGroup[], matchers?: ObjectMatcher[], formatter?: MatcherFormatter) => {
      setAlertGroups(alertGroups);
      if (matchers) {
        setMatchers(matchers);
      }
      if (formatter) {
        setFormatter(formatter);
      }
      setShowModal(true);
    },
    []
  );

  const instancesByState = useMemo(() => {
    const instances = alertGroups.flatMap((group) => group.alerts);
    return groupBy(instances, (instance) => instance.status.state);
  }, [alertGroups]);

  const modalElement = useMemo(
    () => (
      <Modal
        isOpen={showModal}
        onDismiss={handleDismiss}
        closeOnBackdropClick={true}
        closeOnEscape={true}
        title={
          <Stack direction="row" alignItems="center" gap={1} wrap={'wrap'}>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Icon name="x" /> Matchers
            </Stack>
            <Matchers matchers={matchers} formatter={formatter} />
          </Stack>
        }
      >
        <Stack direction="column">
          <AlertGroupsSummary
            active={instancesByState[AlertState.Active]?.length}
            suppressed={instancesByState[AlertState.Suppressed]?.length}
            unprocessed={instancesByState[AlertState.Unprocessed]?.length}
          />
          <div>
            {alertGroups.map((group, index) => (
              <AlertGroup key={index} alertManagerSourceName={alertManagerSourceName} group={group} />
            ))}
          </div>
        </Stack>
        <Modal.ButtonRow>
          <Button type="button" variant="secondary" onClick={handleDismiss}>
            Cancel
          </Button>
        </Modal.ButtonRow>
      </Modal>
    ),
    [alertGroups, handleDismiss, instancesByState, matchers, formatter, showModal, alertManagerSourceName]
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

export { useAddPolicyModal, useDeletePolicyModal, useEditPolicyModal, useAlertGroupsModal };
