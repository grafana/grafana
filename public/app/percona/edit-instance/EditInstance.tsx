import { FC, FormEvent, useEffect, useState } from 'react';
import { Form } from 'react-final-form';
import { useParams } from 'react-router-dom-v5-compat';

import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Alert, Button, HorizontalGroup, Modal, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { Page } from 'app/core/components/Page/Page';
import { InventoryService } from 'app/percona/inventory/Inventory.service';
import { useAppDispatch } from 'app/store/store';

import { Labels } from '../add-instance/components/AddRemoteInstance/FormParts';
import { PMM_EDIT_INSTANCE_PAGE, PMM_SERVICES_PAGE } from '../shared/components/PerconaBootstrapper/PerconaNavigation';
import { useCancelToken } from '../shared/components/hooks/cancelToken.hook';
import { updateServiceAction } from '../shared/core/reducers/services';
import { CustomLabelsUtils } from '../shared/helpers/customLabels';
import { logger } from '../shared/helpers/logger';
import { DbServicePayload } from '../shared/services/services/Services.types';

import { EDIT_INSTANCE_DOCS_LINK, FETCH_SERVICE_CANCEL_TOKEN } from './EditInstance.constants';
import { Messages } from './EditInstance.messages';
import { getStyles } from './EditInstance.styles';
import { EditInstanceFormValues, EditInstanceRouteParams } from './EditInstance.types';
import { getInitialValues, getService } from './EditInstance.utils';

const EditInstancePage: FC = () => {
  const dispatch = useAppDispatch();
  const { serviceId } = useParams() as unknown as EditInstanceRouteParams;
  const [isLoading, setIsLoading] = useState(true);
  const [service, setService] = useState<DbServicePayload>();
  const [generateToken] = useCancelToken();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (serviceId) {
      fetchService(serviceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const fetchService = async (serviceId: string) => {
    setIsLoading(true);
    const result = await InventoryService.getService(serviceId, generateToken(FETCH_SERVICE_CANCEL_TOKEN));
    const service = getService(result);

    setService(service);
    setIsLoading(false);
  };

  const handleCancel = () => {
    locationService.push('/inventory/services');
  };

  const handleSubmit = async (values: EditInstanceFormValues) => {
    if (!service) {
      return;
    }

    try {
      await dispatch(
        updateServiceAction({
          current: service,
          serviceId: service.service_id,
          labels: {
            cluster: values.cluster,
            environment: values.environment,
            replication_set: values.replication_set,
          },
          custom_labels: CustomLabelsUtils.toPayload(values.custom_labels || ''),
        })
      ).unwrap();
      appEvents.emit(AppEvents.alertSuccess, [
        Messages.success.title(service.service_name),
        Messages.success.description,
      ]);
      locationService.push('/inventory/services');
    } catch (error) {
      logger.error(error);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleOpenModal = (e?: FormEvent<HTMLFormElement | HTMLButtonElement>) => {
    setIsModalOpen(true);
    e?.preventDefault();
    e?.stopPropagation();
  };

  return (
    <Form
      initialValues={getInitialValues(service)}
      onSubmit={handleSubmit}
      render={({ handleSubmit, submitting, values }) => (
        <>
          <AppChromeUpdate
            actions={
              <HorizontalGroup height="auto" justify="flex-end">
                <Button
                  size="sm"
                  variant="secondary"
                  data-testid="edit-instance-cancel"
                  type="button"
                  onClick={handleCancel}
                >
                  {Messages.cancel}
                </Button>
                <Button
                  data-testid="edit-instance-submit"
                  size="sm"
                  type="submit"
                  variant="primary"
                  onClick={handleOpenModal}
                  disabled={submitting}
                >
                  {Messages.saveChanges}
                </Button>
              </HorizontalGroup>
            }
          />
          <Modal
            isOpen={isModalOpen}
            title={Messages.formTitle(service?.service_name || '')}
            onDismiss={handleCloseModal}
          >
            <p>
              {Messages.modal.description}
              {Messages.modal.details}
              <a target="_blank" rel="noopener noreferrer" className={styles.link} href={EDIT_INSTANCE_DOCS_LINK}>
                {Messages.modal.detailsLink}
              </a>
              {Messages.modal.dot}
            </p>
            {service?.cluster !== values?.cluster && (
              <Alert title={Messages.modal.cluster.title} severity="warning">
                {Messages.modal.cluster.description}
                <a target="_blank" rel="noopener noreferrer" href={EDIT_INSTANCE_DOCS_LINK} className={styles.link}>
                  {Messages.modal.cluster.descriptionLink}
                </a>
                {Messages.modal.cluster.dot}
              </Alert>
            )}
            <Modal.ButtonRow>
              <Button onClick={handleSubmit}>{Messages.modal.confirm}</Button>
              <Button variant="secondary" onClick={handleCloseModal}>
                {Messages.modal.cancel}
              </Button>
            </Modal.ButtonRow>
          </Modal>
          <Page
            navId={PMM_SERVICES_PAGE.id}
            pageNav={PMM_EDIT_INSTANCE_PAGE}
            renderTitle={() => <h1>{Messages.formTitle(service?.service_name || '')}</h1>}
          >
            <Page.Contents isLoading={isLoading}>
              <form onSubmit={handleOpenModal}>
                <Labels showNodeFields={false} />
                {/* enable submit by keyboard */}
                <input type="submit" className={styles.hidden} />
              </form>
            </Page.Contents>
          </Page>
        </>
      )}
    />
  );
};

export default EditInstancePage;
