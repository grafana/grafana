import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { DataSourceInstanceSettings, DateTime, dateTime, GrafanaTheme2, PanelData, urlUtil } from '@grafana/data';
import { config, getDataSourceSrv, PanelRenderer } from '@grafana/runtime';
import { Alert, CodeEditor, DateTimePicker, LinkButton, useStyles2, useTheme2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { PanelOptions } from 'app/plugins/panel/table/models.gen';
import { AccessControlAction } from 'app/types';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { TABLE, TIMESERIES } from '../../utils/constants';
import { Authorize } from '../Authorize';
import { PanelPluginsButtonGroup, SupportedPanelPlugins } from '../PanelPluginsButtonGroup';

type RuleViewerVisualizationProps = {
  data?: PanelData;
  query: AlertQuery;
  onChangeQuery: (query: AlertQuery) => void;
};

const headerHeight = 4;

export function RuleViewerVisualization(props: RuleViewerVisualizationProps): JSX.Element | null {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { data, query, onChangeQuery } = props;
  const defaultPanel = isExpressionQuery(query.model) ? TABLE : TIMESERIES;
  const [panel, setPanel] = useState<SupportedPanelPlugins>(defaultPanel);
  const dsSettings = getDataSourceSrv().getInstanceSettings(query.datasourceUid);
  const relativeTimeRange = query.relativeTimeRange;
  const [options, setOptions] = useState<PanelOptions>({
    frameIndex: 0,
    showHeader: true,
  });

  const onTimeChange = useCallback(
    (newDateTime: DateTime) => {
      const now = dateTime().unix() - newDateTime.unix();

      if (relativeTimeRange) {
        const interval = relativeTimeRange.from - relativeTimeRange.to;
        onChangeQuery({
          ...query,
          relativeTimeRange: { from: now + interval, to: now },
        });
      }
    },
    [onChangeQuery, query, relativeTimeRange]
  );

  const setDateTime = useCallback((relativeTimeRangeTo: number) => {
    return relativeTimeRangeTo === 0 ? dateTime() : dateTime().subtract(relativeTimeRangeTo, 'seconds');
  }, []);

  if (!data) {
    return null;
  }

  if (!dsSettings) {
    return (
      <div className={styles.content}>
        <Alert title="Could not find datasource for query" />
        <CodeEditor
          width="100%"
          height="250px"
          language="json"
          showLineNumbers={false}
          showMiniMap={false}
          value={JSON.stringify(query, null, '\t')}
          readOnly={true}
        />
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <AutoSizer>
        {({ width, height }) => {
          return (
            <div style={{ width, height }}>
              <div className={styles.header}>
                <div>
                  {`Query ${query.refId}`}
                  <span className={styles.dataSource}>({dsSettings.name})</span>
                </div>
                <div className={styles.actions}>
                  {!isExpressionQuery(query.model) && relativeTimeRange ? (
                    <DateTimePicker
                      date={setDateTime(relativeTimeRange.to)}
                      onChange={onTimeChange}
                      maxDate={new Date()}
                    />
                  ) : null}
                  <PanelPluginsButtonGroup onChange={setPanel} value={panel} size="md" />
                  <Authorize actions={[AccessControlAction.DataSourcesExplore]}>
                    {!isExpressionQuery(query.model) && (
                      <>
                        <div className={styles.spacing} />
                        <LinkButton
                          size="md"
                          variant="secondary"
                          icon="compass"
                          target="_blank"
                          href={createExploreLink(dsSettings, query)}
                        >
                          View in Explore
                        </LinkButton>
                      </>
                    )}
                  </Authorize>
                </div>
              </div>
              <PanelRenderer
                height={height - theme.spacing.gridSize * headerHeight}
                width={width}
                data={data}
                pluginId={panel}
                title=""
                onOptionsChange={setOptions}
                options={options}
              />
            </div>
          );
        }}
      </AutoSizer>
    </div>
  );
}

function createExploreLink(settings: DataSourceInstanceSettings, query: AlertQuery): string {
  const { name } = settings;
  const { refId, ...rest } = query.model;
  const queryParams = { ...rest, datasource: name };

  return urlUtil.renderUrl(`${config.appSubUrl}/explore`, {
    left: JSON.stringify(['now-1h', 'now', name, queryParams]),
  });
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    content: css`
      width: 100%;
      height: 250px;
    `,
    header: css`
      height: ${theme.spacing(headerHeight)};
      display: flex;
      align-items: center;
      justify-content: space-between;
      white-space: nowrap;
    `,
    refId: css`
      font-weight: ${theme.typography.fontWeightMedium};
      color: ${theme.colors.text.link};
      overflow: hidden;
    `,
    dataSource: css`
      margin-left: ${theme.spacing(1)};
      font-style: italic;
      color: ${theme.colors.text.secondary};
    `,
    actions: css`
      display: flex;
      align-items: center;
    `,
    spacing: css`
      padding: ${theme.spacing(0, 1, 0, 0)};
    `,
    errorMessage: css`
      white-space: pre-wrap;
    `,
  };
};
