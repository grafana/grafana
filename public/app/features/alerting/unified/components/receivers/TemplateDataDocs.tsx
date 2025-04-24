import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, Text, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { PopupCard } from '../HoverCard';

import {
  AlertTemplateData,
  GlobalTemplateData,
  KeyValueCodeSnippet,
  KeyValueTemplateFunctions,
  TemplateDataItem,
} from './TemplateData';

export function TemplateDataDocs() {
  const styles = useStyles2(getTemplateDataDocsStyles);

  const AlertTemplateDataTable = (
    <TemplateDataTable
      caption={
        <>
          <Text variant="h4" element="h4" color="primary">
            <Trans i18nKey="alerting.template-data-docs.alert-template-data-table.alert-template-data">
              Alert template data
            </Trans>
          </Text>
          <Text variant="bodySmall">
            <Trans i18nKey="alerting.template-data-docs.alert-template-data-table.only-in-alert">
              Available only when in the context of an Alert (e.g. inside .Alerts loop)
            </Trans>
          </Text>
        </>
      }
      dataItems={AlertTemplateData}
    />
  );

  return (
    <Stack gap={2}>
      <TemplateDataTable
        caption={
          <>
            <Text variant="h4" element="h4" color="primary">
              <Trans i18nKey="alerting.template-data-docs.notification-template-data">Notification template data</Trans>
            </Text>
            <Text variant="bodySmall">
              <Trans i18nKey="alerting.template-data-docs.available-context-notification">
                Available in the context of a notification.
              </Trans>
            </Text>
          </>
        }
        dataItems={GlobalTemplateData}
        typeRenderer={(type) => {
          if (type === '[]Alert') {
            return (
              <PopupCard content={AlertTemplateDataTable}>
                <div className={styles.interactiveType}>{type}</div>
              </PopupCard>
            );
          }
          if (type === 'KeyValue') {
            return (
              <PopupCard content={<KeyValueTemplateDataTable />}>
                <div className={styles.interactiveType}>{type}</div>
              </PopupCard>
            );
          }
          return type;
        }}
      />
    </Stack>
  );
}

const getTemplateDataDocsStyles = (theme: GrafanaTheme2) => ({
  interactiveType: css({
    color: theme.colors.text.link,
  }),
});

interface TemplateDataTableProps {
  dataItems: TemplateDataItem[];
  caption?: JSX.Element | string;
  typeRenderer?: (type: TemplateDataItem['type']) => React.ReactNode;
}

export function TemplateDataTable({ dataItems, caption, typeRenderer }: TemplateDataTableProps) {
  const styles = useStyles2(getTemplateDataTableStyles);

  return (
    <table className={styles.table}>
      {caption && <caption>{caption}</caption>}
      <thead>
        <tr>
          <th>
            <Trans i18nKey="alerting.template-data-table.name">Name</Trans>
          </th>
          <th>
            <Trans i18nKey="alerting.template-data-table.type">Type</Trans>
          </th>
          <th>
            <Trans i18nKey="alerting.template-data-table.notes">Notes</Trans>
          </th>
        </tr>
      </thead>
      <tbody>
        {dataItems.map(({ name, type, notes }, index) => (
          <tr key={index}>
            <td>{name}</td>
            <td>{typeRenderer ? typeRenderer(type) : type}</td>
            <td>{notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KeyValueTemplateDataTable() {
  const tableStyles = useStyles2(getTemplateDataTableStyles);

  return (
    <div>
      <Trans i18nKey="alerting.key-value-template-data-table.description">
        KeyValue is a set of key/value string pairs that represent labels and annotations.
      </Trans>
      <pre>
        <code>{KeyValueCodeSnippet}</code>
      </pre>
      <table className={tableStyles.table}>
        <caption>
          <Trans i18nKey="alerting.key-value-template-data-table.keyvalue-methods">Key-value methods</Trans>
        </caption>
        <thead>
          <tr>
            <th>
              <Trans i18nKey="alerting.key-value-template-data-table.name">Name</Trans>
            </th>
            <th>
              <Trans i18nKey="alerting.key-value-template-data-table.arguments">Arguments</Trans>
            </th>
            <th>
              <Trans i18nKey="alerting.key-value-template-data-table.returns">Returns</Trans>
            </th>
            <th>
              <Trans i18nKey="alerting.key-value-template-data-table.notes">Notes</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {KeyValueTemplateFunctions.map(({ name, args, returns, notes }) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{args}</td>
              <td>{returns}</td>
              <td>{notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const getTemplateDataTableStyles = (theme: GrafanaTheme2) => ({
  table: css({
    borderCollapse: 'collapse',
    width: '100%',

    caption: {
      captionSide: 'top',
    },

    'td, th': {
      padding: theme.spacing(1, 1),
    },

    thead: {
      fontWeight: theme.typography.fontWeightBold,
    },

    'tbody tr:nth-child(2n + 1)': {
      backgroundColor: theme.colors.background.secondary,
    },

    'tbody td:nth-child(1)': {
      fontWeight: theme.typography.fontWeightBold,
    },

    'tbody td:nth-child(2)': {
      fontStyle: 'italic',
    },
  }),
});
