import { groupBy } from 'lodash';
import { FC, useCallback, useMemo, useState } from 'react';

import { Button, Icon, Modal, ModalProps, Spinner, Stack } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { AlertState, AlertmanagerGroup, ObjectMatcher, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { FormAmRoute } from '../../types/amroutes';
import { MatcherFormatter } from '../../utils/matchers';
import { InsertPosition } from '../../utils/routeTree';
import { AlertGroup } from '../alert-groups/AlertGroup';

import { AlertGroupsSummary } from './AlertGroupsSummary';
import { AmRootRouteForm } from './EditDefaultPolicyForm';
import { AmRoutesExpandedForm } from './EditNotificationPolicyForm';
import { Matchers } from './Matchers';
import { NotificationPoliciesErrorAlert } from './PolicyUpdateErrorAlert';

type ModalHook<T = undefined> = [JSX.Element, (item: T) => void, () => void];
type AddModalHook<T = undefined> = [JSX.Element, (item: T, position: InsertPosition) => void, () => void];
type EditModalHook = [JSX.Element, (item: RouteWithID, isDefaultRoute?: boolean) => void, () => void];
const useAddPolicyModal = (
  handleAdd: (route: Partial<FormAmRoute>, referenceRoute: RouteWithID, position: InsertPosition) => Promise<void>,
  loading: boolean
): AddModalHook<RouteWithID> => {
  const [showModal, setShowModal] = useState(false);
  const [insertPosition, setInsertPosition] = useState<InsertPosition | undefined>(undefined);
  const [referenceRoute, setReferenceRoute] = useState<RouteWithID>();

  const handleDismiss = useCallback(() => {
    setReferenceRoute(undefined);
    setInsertPosition(undefined);
    setError(undefined);
    setShowModal(false);
  }, []);

  const handleShow = useCallback((referenceRoute: RouteWithID, position: InsertPosition) => {
    setReferenceRoute(referenceRoute);
    setInsertPosition(position);
    setShowModal(true);
  }, []);

  const [error, setError] = useState<Error | undefined>(undefined);

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
          {error && <NotificationPoliciesErrorAlert error={error} />}
          <AmRoutesExpandedForm
            defaults={{
              groupBy: referenceRoute?.group_by,
            }}
            onSubmit={(newRoute) => {
              if (referenceRoute && insertPosition) {
                handleAdd(newRoute, referenceRoute, insertPosition).catch(setError);
              }
            }}
            actionButtons={
              <Modal.ButtonRow>
                <Button type="button" variant="secondary" onClick={handleDismiss} fill="outline">
                  <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
                </Button>
                <Button type="submit">
                  <Trans i18nKey="alerting.policies.save-policy">Save policy</Trans>
                </Button>
              </Modal.ButtonRow>
            }
          />
        </Modal>
      ),
    [error, handleAdd, handleDismiss, insertPosition, loading, referenceRoute, showModal, setError]
  );

  return [modalElement, handleShow, handleDismiss];
};

const useEditPolicyModal = (
  alertManagerSourceName: string,
  handleUpdate: (route: Partial<FormAmRoute>) => Promise<void>,
  loading: boolean
): EditModalHook => {
  const [showModal, setShowModal] = useState(false);
  const [isDefaultPolicy, setIsDefaultPolicy] = useState(false);
  const [route, setRoute] = useState<RouteWithID>();

  const [error, setError] = useState<Error | undefined>(undefined);

  const handleDismiss = useCallback(() => {
    setRoute(undefined);
    setShowModal(false);
    setError(undefined);
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
          {error && <NotificationPoliciesErrorAlert error={error} />}
          {isDefaultPolicy && route && (
            <AmRootRouteForm
              // TODO *sigh* this alertmanagersourcename should come from context or something
              // passing it down all the way here is a code smell
              alertManagerSourceName={alertManagerSourceName}
              onSubmit={(values) => handleUpdate(values).catch(setError)}
              route={route}
              actionButtons={
                <Modal.ButtonRow>
                  <Button type="button" variant="secondary" onClick={handleDismiss} fill="outline">
                    <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
                  </Button>
                  <Button type="submit">
                    <Trans i18nKey="alerting.policies.default-policy.update">Update default policy</Trans>
                  </Button>
                </Modal.ButtonRow>
              }
            />
          )}
          {!isDefaultPolicy && (
            <AmRoutesExpandedForm
              route={route}
              onSubmit={(values) => handleUpdate(values).catch(setError)}
              actionButtons={
                <Modal.ButtonRow>
                  <Button type="button" variant="secondary" onClick={handleDismiss} fill="outline">
                    <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
                  </Button>
                  <Button type="submit">
                    <Trans i18nKey="alerting.policies.update.update-policy">Update policy</Trans>
                  </Button>
                </Modal.ButtonRow>
              }
            />
          )}
        </Modal>
      ),
    [loading, showModal, handleDismiss, error, isDefaultPolicy, route, alertManagerSourceName, handleUpdate, setError]
  );

  return [modalElement, handleShow, handleDismiss];
};

const useDeletePolicyModal = (
  handleDelete: (route: RouteWithID) => Promise<void>,
  loading: boolean
): ModalHook<RouteWithID> => {
  const [showModal, setShowModal] = useState(false);
  const [route, setRoute] = useState<RouteWithID>();
  const [error, setError] = useState<Error | undefined>(undefined);

  const handleDismiss = useCallback(() => {
    setRoute(undefined);
    setShowModal(false);
    setError(undefined);
  }, [setRoute]);

  const handleShow = useCallback((route: RouteWithID) => {
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
          title="Delete notification policy"
        >
          {error && <NotificationPoliciesErrorAlert error={error} />}
          <Trans i18nKey="alerting.policies.delete.warning-1">
            Deleting this notification policy will permanently remove it.
          </Trans>{' '}
          <Trans i18nKey="alerting.policies.delete.warning-2">Are you sure you want to delete this policy?</Trans>
          <Modal.ButtonRow>
            <Button type="button" variant="destructive" onClick={() => route && handleDelete(route).catch(setError)}>
              <Trans i18nKey="alerting.policies.delete.confirm">Yes, delete policy</Trans>
            </Button>
            <Button type="button" variant="secondary" onClick={handleDismiss}>
              <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
            </Button>
          </Modal.ButtonRow>
        </Modal>
      ),
    [handleDismiss, loading, showModal, error, route, handleDelete]
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
              <Icon name="x" /> <Trans i18nKey="alerting.policies.matchers">Matchers</Trans>
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
            <Trans i18nKey="alerting.common.cancel">Cancel</Trans>
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
        <Trans i18nKey="alerting.policies.update.updating">Updating...</Trans> <Spinner inline />
      </Stack>
    }
  >
    <Trans i18nKey="alerting.policies.update.please-wait">
      Please wait while we update your notification policies.
    </Trans>
  </Modal>
);

export { useAddPolicyModal, useAlertGroupsModal, useDeletePolicyModal, useEditPolicyModal };
