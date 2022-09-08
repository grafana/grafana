import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Stack, useStyles2 } from '@grafana/ui/src';

export function TemplateDataDocs() {
  const styles = useStyles2(getTemplateDataDocsStyles);

  return (
    <Stack gap={2}>
      <TemplateDataTable caption={<h4 className={styles.header}>Template Data</h4>} dataItems={GlobalTemplateData} />
      <TemplateDataTable
        caption={
          <h4 className={styles.header}>
            Alert template data <span>Available only when in the context of an Alert (e.g. inside .Alerts loop)</span>
          </h4>
        }
        dataItems={AlertTemplateData}
      />
    </Stack>
  );
}

const getTemplateDataDocsStyles = (theme: GrafanaTheme2) => ({
  header: css`
    color: ${theme.colors.text.primary};

    span {
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
    }
  `,
});

function TemplateDataTable({ dataItems, caption }: { dataItems: TemplateDataItem[]; caption: JSX.Element | string }) {
  const styles = useStyles2(getTemplateDataTableStyles);

  return (
    <table className={styles.table}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {dataItems.map(({ name, type, notes }, index) => (
          <tr key={index}>
            <td>{name}</td>
            <td>{type}</td>
            <td>{notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const getTemplateDataTableStyles = (theme: GrafanaTheme2) => ({
  table: css`
    table-layout: fixed;
    border-collapse: collapse;
    width: 100%;

    caption {
      caption-side: top;
    }

    td,
    th {
      padding: ${theme.spacing(1, 2)};
    }

    thead {
      font-weight: ${theme.typography.fontWeightBold};
    }

    thead th:nth-child(1) {
      width: 180px;
    }

    thead th:nth-child(2) {
      width: 120px;
    }

    thead th:nth-child(3) {
      width: auto;
      max-width: 400px;
    }

    tbody tr:nth-child(2n + 1) {
      background-color: ${theme.colors.background.secondary};
    }

    tbody td:nth-child(1) {
      font-weight: ${theme.typography.fontWeightBold};
    }

    tbody td:nth-child(2) {
      font-style: italic;
    }
  `,
});

interface TemplateDataItem {
  name: string;
  type: 'string' | '[]Alert' | 'KeyValue' | 'time.Time';
  notes: string;
}

const GlobalTemplateData: TemplateDataItem[] = [
  {
    name: 'Receiver',
    type: 'string',
    notes: 'Name of the contact point that the notification is being sent to.',
  },
  {
    name: 'Status',
    type: 'string',
    notes: 'firing if at least one alert is firing, otherwise resolved',
  },
  {
    name: 'Alerts',
    type: '[]Alert',
    notes: 'List of alert objects that are included in this notification.',
  },
  {
    name: 'Alerts.Firing',
    type: '[]Alert',
    notes: 'List of firing alerts',
  },
  {
    name: 'Alerts.Resolved',
    type: '[]Alert',
    notes: 'List of resolved alerts',
  },
  {
    name: 'GroupLabels',
    type: 'KeyValue',
    notes: 'Labels these alerts were grouped by.',
  },
  {
    name: 'CommonLabels',
    type: 'KeyValue',
    notes: 'Labels common to all the alerts included in this notification.',
  },
  {
    name: 'CommonAnnotations',
    type: 'KeyValue',
    notes: 'Annotations common to all the alerts included in this notification.',
  },
  {
    name: 'ExternalURL',
    type: 'string',
    notes: 'Back link to the Grafana that sent the notification.',
  },
];

const AlertTemplateData: TemplateDataItem[] = [
  {
    name: 'Status',
    type: 'string',
    notes: 'firing or resolved.',
  },
  {
    name: 'Labels',
    type: 'KeyValue',
    notes: 'A set of labels attached to the alert.',
  },
  {
    name: 'Annotations',
    type: 'KeyValue',
    notes: 'A set of annotations attached to the alert.',
  },
  {
    name: 'StartsAt',
    type: 'time.Time',
    notes: 'Time the alert started firing.',
  },
  {
    name: 'EndsAt',
    type: 'time.Time',
    notes:
      'Only set if the end time of an alert is known. Otherwise set to a configurable timeout period from the time since the last alert was received.',
  },
  {
    name: 'GeneratorURL',
    type: 'string',
    notes: 'A back link to Grafana or external Alertmanager.',
  },
  {
    name: 'SilenceURL',
    type: 'string',
    notes: 'Link to grafana silence for with labels for this alert pre-filled. Only for Grafana managed alerts.',
  },
  {
    name: 'DashboardURL',
    type: 'string',
    notes: 'Link to grafana dashboard, if alert rule belongs to one. Only for Grafana managed alerts.',
  },
  {
    name: 'PanelURL',
    type: 'string',
    notes: 'Link to grafana dashboard panel, if alert rule belongs to one. Only for Grafana managed alerts.',
  },
  {
    name: 'Fingerprint',
    type: 'string',
    notes: 'Fingerprint that can be used to identify the alert.',
  },
  {
    name: 'ValueString',
    type: 'string',
    notes: 'A string that contains the labels and value of each reduced expression in the alert.',
  },
];
