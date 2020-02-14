import React from 'react';
import { css } from 'emotion';
import { stylesFactory, withTheme, Themeable, Forms } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { Option } from './QueryHistory';

interface QueryHistorySettingsProps extends Themeable {
  activeHistoryTimeSpan: string;
  activeStarredTab: boolean;
  showHistoryForActiveDatasource: boolean;
  hiddenSessions: boolean;
  onChangeActiveHistoryTimeSpan: (option: Option) => void;
  onChangeActiveStarredTab: () => void;
  onChangeShowHistoryForActiveDatasource: () => void;
  onChangeHideSessions: () => void;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      font-size: ${theme.typography.size.sm};
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

const selectOptions = [
  { value: '2 days', label: '2 days' },
  { value: '5 days', label: '5 days' },
  { value: '1 week', label: '1 week' },
];

function UnThemedQueryHistorySettings(props: QueryHistorySettingsProps) {
  const {
    theme,
    activeHistoryTimeSpan,
    activeStarredTab,
    showHistoryForActiveDatasource,
    hiddenSessions,
    onChangeActiveHistoryTimeSpan,
    onChangeActiveStarredTab,
    onChangeShowHistoryForActiveDatasource,
    onChangeHideSessions,
  } = props;
  const styles = getStyles(theme);
  const selectedOption = selectOptions.find(v => v.value === activeHistoryTimeSpan);

  return (
    <div className={styles.container}>
      <Forms.Field
        label="History time span"
        description="Select the period of time for which Grafana will save your query history"
      >
        <div className={styles.input}>
          <Forms.Select
            value={selectedOption}
            options={selectOptions}
            onChange={onChangeActiveHistoryTimeSpan}
          ></Forms.Select>
        </div>
      </Forms.Field>
      <Forms.Field label="Default active tab" description=" ">
        <div className={styles.switch}>
          <Forms.Switch value={activeStarredTab} onChange={onChangeActiveStarredTab}></Forms.Switch>
          <div className={styles.label}>Change the default active tab from “Query history” to “Starred”</div>
        </div>
      </Forms.Field>
      <Forms.Field label="Datasource behaviour" description=" ">
        <div className={styles.switch}>
          <Forms.Switch
            value={showHistoryForActiveDatasource}
            onChange={onChangeShowHistoryForActiveDatasource}
          ></Forms.Switch>
          <div className={styles.label}>Only show queries for datasource currently active in Explore</div>
        </div>
      </Forms.Field>
      <Forms.Field label="Query list options" description=" ">
        <div className={styles.switch}>
          <Forms.Switch value={hiddenSessions} onChange={onChangeHideSessions}></Forms.Switch>
          <div className={styles.label}>Hide sessions by default</div>
        </div>
      </Forms.Field>
    </div>
  );
}

export const QueryHistorySettings = withTheme(UnThemedQueryHistorySettings);
QueryHistorySettings.displayName = 'QueryHistorySettings';
