import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents } from '@grafana/runtime';
import { useStyles2, Select, Button, Field, InlineField, InlineSwitch, Alert } from '@grafana/ui';
import { notifyApp } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { MAX_HISTORY_ITEMS } from 'app/core/history/RichHistoryLocalStorage';
import { dispatch } from 'app/store/store';

import { supportedFeatures } from '../../../core/history/richHistoryStorageProvider';
import { ShowConfirmModalEvent } from '../../../types/events';

export interface RichHistorySettingsProps {
  retentionPeriod: number;
  starredTabAsFirstTab: boolean;
  activeDatasourcesOnly: boolean;
  onChangeRetentionPeriod: (option: SelectableValue<number>) => void;
  toggleStarredTabAsFirstTab: () => void;
  toggleActiveDatasourcesOnly: () => void;
  deleteRichHistory: () => void;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    spaceBetween: css({
      marginBottom: theme.spacing(3),
    }),
    input: css({
      maxWidth: '200px',
    }),
    bold: css({
      fontWeight: theme.typography.fontWeightBold,
    }),
    bottomMargin: css({
      marginBottom: theme.spacing(1),
    }),
  };
};

export function RichHistorySettingsTab(props: RichHistorySettingsProps) {
  const {
    retentionPeriod,
    starredTabAsFirstTab,
    activeDatasourcesOnly,
    onChangeRetentionPeriod,
    toggleStarredTabAsFirstTab,
    toggleActiveDatasourcesOnly,
    deleteRichHistory,
  } = props;
  const styles = useStyles2(getStyles);

  const retentionPeriodOptions = [
    { value: 2, label: t('explore.rich-history-settings-tab.retention-period.2-days', '2 days') },
    { value: 5, label: t('explore.rich-history-settings-tab.retention-period.5-days', '5 days') },
    { value: 7, label: t('explore.rich-history-settings-tab.retention-period.1-week', '1 week') },
    { value: 14, label: t('explore.rich-history-settings-tab.retention-period.2-weeks', '2 weeks') },
  ];
  const selectedOption = retentionPeriodOptions.find((v) => v.value === retentionPeriod);

  const onDelete = () => {
    getAppEvents().publish(
      new ShowConfirmModalEvent({
        title: t('explore.rich-history-settings-tab.delete-title', 'Delete'),
        text: t(
          'explore.rich-history-settings-tab.delete-confirm-text',
          'Are you sure you want to permanently delete your query history?'
        ),
        yesText: t('explore.rich-history-settings-tab.delete-confirm', 'Delete'),
        icon: 'trash-alt',
        onConfirm: () => {
          deleteRichHistory();
          dispatch(
            notifyApp(
              createSuccessNotification(
                t('explore.rich-history-settings-tab.query-history-deleted', 'Query history deleted')
              )
            )
          );
        },
      })
    );
  };

  return (
    <div className={styles.container}>
      {supportedFeatures().changeRetention ? (
        <Field
          label={t('explore.rich-history-settings-tab.history-time-span', 'History time span')}
          description={t(
            'explore.rich-history-settings-tab.history-time-span-description',
            'Select the period of time for which Grafana will save your query history. Up to {{MAX_HISTORY_ITEMS}} entries will be stored.',
            { MAX_HISTORY_ITEMS }
          )}
        >
          <div className={styles.input}>
            <Select value={selectedOption} options={retentionPeriodOptions} onChange={onChangeRetentionPeriod}></Select>
          </div>
        </Field>
      ) : (
        <Alert severity="info" title={t('explore.rich-history-settings-tab.history-time-span', 'History time span')}>
          {t(
            'explore.rich-history-settings-tab.alert-info',
            "Grafana will keep entries up to {{optionLabel}}.Starred entries won't be deleted.",
            {
              optionLabel: selectedOption?.label,
            }
          )}
        </Alert>
      )}
      <InlineField
        label={t(
          'explore.rich-history-settings-tab.change-default-tab',
          'Change the default active tab from “Query history” to “Starred”'
        )}
        className={styles.spaceBetween}
      >
        <InlineSwitch
          id="explore-query-history-settings-default-active-tab"
          value={starredTabAsFirstTab}
          onChange={toggleStarredTabAsFirstTab}
        />
      </InlineField>
      {supportedFeatures().onlyActiveDataSource && (
        <InlineField
          label={t(
            'explore.rich-history-settings-tab.only-show-active-datasource',
            'Only show queries for data source currently active in Explore'
          )}
          className={styles.spaceBetween}
        >
          <InlineSwitch
            id="explore-query-history-settings-data-source-behavior"
            value={activeDatasourcesOnly}
            onChange={toggleActiveDatasourcesOnly}
          />
        </InlineField>
      )}
      {supportedFeatures().clearHistory && (
        <div>
          <div className={styles.bold}>
            <Trans i18nKey="explore.rich-history-settings-tab.clear-query-history">Clear query history</Trans>
          </div>
          <div className={styles.bottomMargin}>
            <Trans i18nKey="explore.rich-history-settings-tab.clear-history-info">
              Delete all of your query history, permanently.
            </Trans>
          </div>
          <Button variant="destructive" onClick={onDelete}>
            <Trans i18nKey="explore.rich-history-settings-tab.clear-query-history-button">Clear query history</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}
