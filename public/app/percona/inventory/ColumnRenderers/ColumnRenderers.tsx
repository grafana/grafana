import React from 'react';
import { MAIN_COLUMN } from 'app/percona/inventory/Inventory.constants';
import { CustomLabel } from 'app/percona/inventory/Inventory.types';
import * as styles from './ColumnRenderers.styles';

export const servicesDetailsRender = (element: any) => {
  const labels = Object.keys(element).filter(label => !MAIN_COLUMN.includes(label));

  return (
    <div className={styles.detailsWrapper}>
      {labels.map((label, accessor) =>
        element[label] ? <span key={accessor}>{`${label}: ${element[label]}`}</span> : null
      )}
      {getCustomLabels(element.custom_labels)}
    </div>
  );
};

export const agentsDetailsRender = (element: any) => {
  const mainColumns = ['agent_id', 'type', 'isDeleted', 'service_ids', 'custom_labels'];
  const labels = Object.keys(element).filter(label => !mainColumns.includes(label));

  return (
    <div className={styles.detailsWrapper}>
      {labels.map((label, key) => (element[label] ? <span key={key}>{`${label}: ${element[label]}`}</span> : null))}
      {element.username ? <span>password: ******</span> : null}
      {element.service_ids && element.service_ids.length ? (
        <>
          service_ids:{' '}
          <span>
            {element.service_ids.map((serviceId: any) => (
              <span key={serviceId}>{serviceId}</span>
            ))}
          </span>
        </>
      ) : null}
      {getCustomLabels(element.custom_labels)}
    </div>
  );
};

export const nodesDetailsRender = (element: any) => {
  const mainColumns = ['node_id', 'node_name', 'address', 'custom_labels', 'type', 'isDeleted'];
  const labels = Object.keys(element).filter(label => !mainColumns.includes(label));

  return (
    <div className={styles.detailsWrapper}>
      {labels.map((label, key) => (element[label] ? <span key={key}>{`${label}: ${element[label]}`}</span> : null))}
      {getCustomLabels(element.custom_labels)}
    </div>
  );
};

export const getCustomLabels = (customLabels: CustomLabel[]) =>
  Array.isArray(customLabels)
    ? customLabels.map(({ key, value }) => <span key={key}> {`${key}: ${value}`}</span>)
    : null;
