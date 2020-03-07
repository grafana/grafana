import React from 'react';
import { css } from 'emotion';
import { stylesFactory, useTheme, Forms } from '@grafana/ui';
import { GrafanaTheme, AppEvents } from '@grafana/data';
import appEvents from 'app/core/app_events';

interface RichHistorySettingsProps {
  retentionPeriod: number;
  starredTabAsFirstTab: boolean;
  activeDatasourceOnly: boolean;
  onChangeRetentionPeriod: (option: { label: string; value: number }) => void;
  toggleStarredTabAsFirstTab: () => void;
  toggleactiveDatasourceOnly: () => void;
  deleteRichHistory: () => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      padding-left: ${theme.spacing.sm};
      font-size: ${theme.typography.size.sm};
      .space-between {
        margin-bottom: ${theme.spacing.lg};
      }
    `,
    input: css`
      max-width: 200px;
    `,
    switch: css`
      display: flex;
      align-items: center;
    `,
    label: css`
      margin-left: ${theme.spacing.md};
    `,
  };
});

const retentionPeriodOptions = [
  { value: 2, label: '2 days' },
  { value: 5, label: '5 days' },
  { value: 7, label: '1 week' },
  { value: 14, label: '2 weeks' },
];

export function RichHistorySettings(props: RichHistorySettingsProps) {
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
  const selectedOption = retentionPeriodOptions.find(v => v.value === retentionPeriod);

  return (
    <div className={styles.container}>
      <Forms.Field
        label="History time span"
        description="Select the period of time for which Grafana will save your query history"
        className="space-between"
      >
        <div className={styles.input}>
          <Forms.Select
            value={selectedOption}
            options={retentionPeriodOptions}
            onChange={onChangeRetentionPeriod}
          ></Forms.Select>
        </div>
      </Forms.Field>
      <Forms.Field label="Default active tab" description=" " className="space-between">
        <div className={styles.switch}>
          <Forms.Switch value={starredTabAsFirstTab} onChange={toggleStarredTabAsFirstTab}></Forms.Switch>
          <div className={styles.label}>Change the default active tab from “Query history” to “Starred”</div>
        </div>
      </Forms.Field>
      <Forms.Field label="Datasource behaviour" description=" " className="space-between">
        <div className={styles.switch}>
          <Forms.Switch value={activeDatasourceOnly} onChange={toggleactiveDatasourceOnly}></Forms.Switch>
          <div className={styles.label}>Only show queries for datasource currently active in Explore</div>
        </div>
      </Forms.Field>
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
      <Forms.Button
        variant="destructive"
        onClick={() => {
          deleteRichHistory();
          appEvents.emit(AppEvents.alertSuccess, ['Query history deleted']);
        }}
      >
        Clear query history
      </Forms.Button>
    </div>
  );
}
