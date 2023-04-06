import { css, cx } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  DataSourceInstanceSettings,
  DateTime,
  dateTime,
  GrafanaTheme2,
  PanelData,
  RelativeTimeRange,
  urlUtil,
} from '@grafana/data';
import { config, getDataSourceSrv, PanelRenderer } from '@grafana/runtime';
import { Alert, CodeEditor, DateTimePicker, LinkButton, useStyles2, useTheme2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { PanelOptions } from 'app/plugins/panel/table/panelcfg.gen';
import { AccessControlAction } from 'app/types';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { TABLE, TIMESERIES } from '../../utils/constants';
import { Authorize } from '../Authorize';
import { PanelPluginsButtonGroup, SupportedPanelPlugins } from '../PanelPluginsButtonGroup';

interface RuleViewerVisualizationProps
  extends Pick<AlertQuery, 'refId' | 'datasourceUid' | 'model' | 'relativeTimeRange'> {
  data?: PanelData;
  onTimeRangeChange: (range: RelativeTimeRange) => void;
  className?: string;
}

const headerHeight = 4;

export function RuleViewerVisualization({
  data,
  refId,
  model,
  datasourceUid,
  relativeTimeRange,
  onTimeRangeChange,
  className,
}: RuleViewerVisualizationProps): JSX.Element | null {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const defaultPanel = isExpressionQuery(model) ? TABLE : TIMESERIES;
  const [panel, setPanel] = useState<SupportedPanelPlugins>(defaultPanel);
  const dsSettings = getDataSourceSrv().getInstanceSettings(datasourceUid);
  const [options, setOptions] = useState<PanelOptions>({
    frameIndex: 0,
    showHeader: true,
  });

  const onTimeChange = useCallback(
    (newDateTime: DateTime) => {
      const now = dateTime().unix() - newDateTime.unix();

      if (relativeTimeRange) {
        const interval = relativeTimeRange.from - relativeTimeRange.to;
        onTimeRangeChange({ from: now + interval, to: now });
      }
    },
    [onTimeRangeChange, relativeTimeRange]
  );

  const setDateTime = useCallback((relativeTimeRangeTo: number) => {
    return relativeTimeRangeTo === 0 ? dateTime() : dateTime().subtract(relativeTimeRangeTo, 'seconds');
  }, []);

  if (!data) {
    return null;
  }

  if (!dsSettings) {
    return (
      <div className={cx(styles.content, className)}>
        <Alert title="Could not find datasource for query" />
        <CodeEditor
          width="100%"
          height="250px"
          language="json"
          showLineNumbers={false}
          showMiniMap={false}
          value={JSON.stringify(model, null, '\t')}
          readOnly={true}
        />
      </div>
    );
  }

  return (
    <div className={cx(styles.content, className)}>
      <AutoSizer>
        {({ width, height }) => {
          return (
            <div style={{ width, height }}>
              <div className={styles.header}>
                <div className={styles.actions}>
                  {!isExpressionQuery(model) && relativeTimeRange ? (
                    <DateTimePicker
                      date={setDateTime(relativeTimeRange.to)}
                      onChange={onTimeChange}
                      maxDate={new Date()}
                    />
                  ) : null}
                  <PanelPluginsButtonGroup onChange={setPanel} value={panel} size="md" />
                  <Authorize actions={[AccessControlAction.DataSourcesExplore]}>
                    {!isExpressionQuery(model) && (
                      <>
                        <div className={styles.spacing} />
                        <LinkButton
                          size="md"
                          variant="secondary"
                          icon="compass"
                          target="_blank"
                          href={createExploreLink(dsSettings, model)}
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

function createExploreLink(settings: DataSourceInstanceSettings, model: AlertDataQuery): string {
  const { name } = settings;
  const { refId, ...rest } = model;

  return urlUtil.renderUrl(`${config.appSubUrl}/explore`, {
    left: JSON.stringify({
      datasource: name,
      queries: [{ refId: 'A', ...rest }],
      range: { from: 'now-1h', to: 'now' },
    }),
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
      justify-content: flex-end;
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
