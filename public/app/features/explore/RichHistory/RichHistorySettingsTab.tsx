import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { stylesFactory, useTheme, Select, Button, Field, InlineField, InlineSwitch, Alert } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import appEvents from 'app/core/app_events';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { MAX_HISTORY_ITEMS } from 'app/core/history/RichHistoryLocalStorage';
import { dispatch } from 'app/store/store';

import { supportedFeatures } from '../../../core/history/richHistoryStorageProvider';
import { ShowConfirmModalEvent } from '../../../types/events';

export interface RichHistorySettingsProps {
  retentionPeriod: number;
  starredTabAsFirstTab: boolean;
  activeDatasourceOnly: boolean;
  onChangeRetentionPeriod: (option: SelectableValue<number>) => void;
  toggleStarredTabAsFirstTab: () => void;
  toggleactiveDatasourceOnly: () => void;
  deleteRichHistory: () => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      font-size: ${theme.typography.size.sm};
      .space-between {
        margin-bottom: ${theme.spacing.lg};
      }
    `,
    input: css`
      max-width: 200px;
    `,
  };
});

const retentionPeriodOptions = [
  { value: 2, label: '2 days' },
  { value: 5, label: '5 days' },
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
];

export function RichHistorySettingsTab(props: RichHistorySettingsProps) {
  const {
    retentionPeriod,
    starredTabAsFirstTab,
    activeDatasourceOnly,
    onChangeRetentionPeriod,
    toggleStarredTabAsFirstTab,
    toggleactiveDatasourceOnly,
    deleteRichHistory,
  } = props;
  const theme = useTheme();
  const styles = getStyles(theme);
  const selectedOption = retentionPeriodOptions.find((v) => v.value === retentionPeriod);

  const onDelete = () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete',
        text: 'Are you sure you want to permanently delete your query history?',
        yesText: 'Delete',
        icon: 'trash-alt',
        onConfirm: () => {
          deleteRichHistory();
          dispatch(notifyApp(createSuccessNotification('Query history deleted')));
        },
      })
    );
  };

  return (
    <div className={styles.container}>
      {supportedFeatures().changeRetention ? (
        <Field
          label="History time span"
          description={`Select the period of time for which Grafana will save your query history. Up to ${MAX_HISTORY_ITEMS} entries will be stored.`}
          className="space-between"
        >
          <div className={styles.input}>
            <Select value={selectedOption} options={retentionPeriodOptions} onChange={onChangeRetentionPeriod}></Select>
          </div>
        </Field>
      ) : (
        <Alert severity="info" title="History time span">
          Grafana will keep entries up to {selectedOption?.label}.
        </Alert>
      )}
      <InlineField label="Change the default active tab from “Query history” to “Starred”" className="space-between">
        <InlineSwitch
          id="explore-query-history-settings-default-active-tab"
          value={starredTabAsFirstTab}
          onChange={toggleStarredTabAsFirstTab}
        />
      </InlineField>
      {supportedFeatures().onlyActiveDataSource && (
        <InlineField label="Only show queries for data source currently active in Explore" className="space-between">
          <InlineSwitch
            id="explore-query-history-settings-data-source-behavior"
            value={activeDatasourceOnly}
            onChange={toggleactiveDatasourceOnly}
          />
        </InlineField>
      )}
      {supportedFeatures().clearHistory && (
        <div>
          <div
            className={css`
              font-weight: ${theme.typography.weight.bold};
            `}
          >
            Clear query history
          </div>
          <div
            className={css`
              margin-bottom: ${theme.spacing.sm};
            `}
          >
            Delete all of your query history, permanently.
          </div>
          <Button variant="destructive" onClick={onDelete}>
            Clear query history
          </Button>
        </div>
      )}
    </div>
  );
}
