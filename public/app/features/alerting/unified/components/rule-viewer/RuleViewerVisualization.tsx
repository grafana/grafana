import { css, cx } from '@emotion/css';
import React, { useCallback } from 'react';

import {
  DataSourceInstanceSettings,
  DateTime,
  dateTime,
  GrafanaTheme2,
  PanelData,
  RelativeTimeRange,
  urlUtil,
} from '@grafana/data';
import { config, getDataSourceSrv } from '@grafana/runtime';
import { Alert, CodeEditor, DateTimePicker, LinkButton, useStyles2 } from '@grafana/ui';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { AccessControlAction } from 'app/types';
import { AlertDataQuery, AlertQuery } from 'app/types/unified-alerting-dto';

import { Authorize } from '../Authorize';
import { VizWrapper } from '../rule-editor/VizWrapper';

interface RuleViewerVisualizationProps
  extends Pick<AlertQuery, 'refId' | 'datasourceUid' | 'model' | 'relativeTimeRange'> {
  data?: PanelData;
  onTimeRangeChange: (range: RelativeTimeRange) => void;
  className?: string;
}

const headerHeight = 4;

export function RuleViewerVisualization({
  data,
  model,
  datasourceUid,
  relativeTimeRange,
  onTimeRangeChange,
  className,
}: RuleViewerVisualizationProps): JSX.Element | null {
  const styles = useStyles2(getStyles);
  const dsSettings = getDataSourceSrv().getInstanceSettings(datasourceUid);

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
      <div className={styles.header}>
        <div className={styles.actions}>
          {!isExpressionQuery(model) && relativeTimeRange ? (
            <DateTimePicker date={setDateTime(relativeTimeRange.to)} onChange={onTimeChange} maxDate={new Date()} />
          ) : null}
          <Authorize actions={[AccessControlAction.DataSourcesExplore]}>
            {!isExpressionQuery(model) && (
              <>
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
      <VizWrapper data={data} />
    </div>
  );
}

function createExploreLink(settings: DataSourceInstanceSettings, model: AlertDataQuery): string {
  const { name } = settings;
  const { refId, ...rest } = model;

  /*
    In my testing I've found some alerts that don't have a data source embedded inside the model.

    At this moment in time it is unclear to me why some alert definitions not have a data source embedded in the model.
    Ideally we'd resolve the datasource name to the proper datasource Ref "{ type: string, uid: string }" and pass that in to the model.

    I don't think that should happen here, the fact that the datasource ref is sometimes missing here is a symptom of another cause. (Gilles)
   */
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
      height: 380px;
    `,
    header: css`
      height: ${theme.spacing(headerHeight)};
      display: flex;
      align-items: center;
      justify-content: flex-end;
      white-space: nowrap;
      margin-bottom: ${theme.spacing(2)};
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
    errorMessage: css`
      white-space: pre-wrap;
    `,
  };
};
