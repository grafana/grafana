/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Row } from 'react-table';
import { useLocalStorage } from 'react-use';

import { locationService } from '@grafana/runtime';
import { Button, HorizontalGroup, Icon, InlineSwitch, Tooltip, useStyles2 } from '@grafana/ui';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { ReadMoreLink } from 'app/percona/shared/components/Elements/TechnicalPreview/TechnicalPreview';
import { TabbedPage, TabbedPageContents } from 'app/percona/shared/components/TabbedPage';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { fetchActiveServiceTypesAction, fetchServicesAction } from 'app/percona/shared/core/reducers/services';
import { getServices } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { CLUSTERS_SWITCH_KEY, GET_SERVICES_CANCEL_TOKEN } from '../Inventory.constants';
import { Messages } from '../Inventory.messages';
import { FlattenService } from '../Inventory.types';
import DeleteServiceModal from '../components/DeleteServiceModal';
import DeleteServicesModal from '../components/DeleteServicesModal';

import Clusters from './Services/Clusters';
import ServicesTable from './Services/ServicesTable';
import { getAgentsMonitoringStatus } from './Services.utils';
import { getStyles } from './Tabs.styles';

export const Services = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelectedRows] = useState<Array<Row<FlattenService>>>([]);
  const [actionItem, setActionItem] = useState<FlattenService | null>(null);
  const navModel = usePerconaNavModel('inventory-services');
  const [generateToken] = useCancelToken();
  const dispatch = useAppDispatch();
  const { isLoading, services: fetchedServices } = useSelector(getServices);
  const styles = useStyles2(getStyles);
  const flattenServices = useMemo(
    () =>
      fetchedServices.map((value) => {
        return {
          type: value.type,
          ...value.params,
          cluster: value.params.cluster || value.params.customLabels?.cluster || '',
          agentsStatus: getAgentsMonitoringStatus(value.params.agents ?? []),
        };
      }),
    [fetchedServices]
  );
  const [showClusters, setShowClusters] = useLocalStorage(CLUSTERS_SWITCH_KEY, false);

  const loadData = useCallback(async () => {
    try {
      await dispatch(fetchServicesAction({ token: generateToken(GET_SERVICES_CANCEL_TOKEN) }));
      await dispatch(fetchActiveServiceTypesAction());
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAddService = useCallback(() => {
    locationService.push('/add-instance');
  }, []);

  useEffect(() => {
    loadData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectionChange = useCallback((rows: Array<Row<FlattenService>>) => {
    setSelectedRows(rows);
  }, []);

  const handleDelete = useCallback((service: FlattenService) => {
    setActionItem(service);
    setModalVisible(true);
  }, []);

  const onModalClose = useCallback(() => {
    setModalVisible(false);
    setActionItem(null);
  }, []);

  const onDeleteSuccess = useCallback(() => {
    setSelectedRows([]);
    onModalClose();
    loadData();
  }, [onModalClose, loadData]);

  return (
    <TabbedPage navModel={navModel} isLoading={isLoading}>
      <TabbedPageContents>
        <FeatureLoader>
          <HorizontalGroup height={40} justify="flex-end" align="flex-start">
            <HorizontalGroup align="center">
              <InlineSwitch
                id="organize-by-clusters"
                label={Messages.services.organizeByClusters}
                className={styles.clustersSwitch}
                value={showClusters}
                onClick={() => setShowClusters(!showClusters)}
                showLabel
                transparent
              />
              <Tooltip interactive placement="top" theme="info" content={<ReadMoreLink />}>
                <div className={styles.technicalPreview}>
                  <HorizontalGroup align="center" spacing="xs">
                    <span>{Messages.services.technicalPreview}</span>
                    <Icon name="info-circle" />
                  </HorizontalGroup>
                </div>
              </Tooltip>
            </HorizontalGroup>
            <Button
              size="md"
              disabled={selected.length === 0}
              onClick={() => {
                setModalVisible(true);
              }}
              icon="trash-alt"
              variant="destructive"
            >
              {Messages.delete}
            </Button>
            <Button icon="plus" onClick={onAddService}>
              {Messages.services.add}
            </Button>
          </HorizontalGroup>
          {actionItem ? (
            <DeleteServiceModal
              serviceId={actionItem.serviceId}
              serviceName={actionItem.serviceName}
              isOpen={modalVisible}
              onCancel={onModalClose}
              onSuccess={onDeleteSuccess}
            />
          ) : (
            <DeleteServicesModal
              services={selected}
              isOpen={modalVisible}
              onSuccess={onDeleteSuccess}
              onDismiss={onModalClose}
            />
          )}
          {showClusters ? (
            <Clusters services={flattenServices} onDelete={handleDelete} onSelectionChange={handleSelectionChange} />
          ) : (
            <ServicesTable
              flattenServices={flattenServices}
              onSelectionChange={handleSelectionChange}
              onDelete={handleDelete}
              isLoading={isLoading}
            />
          )}
        </FeatureLoader>
      </TabbedPageContents>
    </TabbedPage>
  );
};

export default Services;
