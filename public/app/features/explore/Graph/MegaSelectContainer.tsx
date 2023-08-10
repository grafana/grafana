import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import {
  DataFrame,
  EventBus,
  AbsoluteTimeRange,
  TimeZone,
  SplitOpen,
  LoadingState,
  ThresholdsConfig,
  GrafanaTheme2,
} from '@grafana/data';
import { Button, GraphThresholdsStyleConfig, PanelChrome, PanelChromeProps, useStyles2 } from '@grafana/ui';
import { ExploreGraphStyle } from 'app/types';

import { MegaSelectOptions } from '../Explore';
import { storeGraphStyle } from '../state/utils';

import { ExploreGraphLabel } from './ExploreGraphLabel';
import { MegaSelectGraph } from './MegaSelectGraph';
import { loadGraphStyle } from './utils';

interface Props extends Pick<PanelChromeProps, 'statusMessage'> {
  width: number;
  height: number;
  data: DataFrame[];
  annotations?: DataFrame[];
  eventBus: EventBus;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  onChangeTime: (absoluteRange: AbsoluteTimeRange) => void;
  splitOpenFn: SplitOpen;
  loadingState: LoadingState;
  thresholdsConfig?: ThresholdsConfig;
  thresholdsStyle?: GraphThresholdsStyleConfig;
  actionsOverride?: JSX.Element;
  options: MegaSelectOptions;
  setMegaSelectCompareFrame?: (megaSelectCompareFrame: DataFrame[]) => void;
  megaSelectCompareFrame?: DataFrame[];
}

const getStyles = (theme: GrafanaTheme2) => ({
  compareButton: css`
    position: absolute;
    right: 0;
    top: 0;
    transform: scale(0.75);
  `,
});

export const MegaSelectContainer = ({
  data,
  eventBus,
  height,
  width,
  absoluteRange,
  timeZone,
  annotations,
  onChangeTime,
  splitOpenFn,
  thresholdsConfig,
  thresholdsStyle,
  loadingState,
  statusMessage,
  actionsOverride,
  options,
  setMegaSelectCompareFrame,
  megaSelectCompareFrame,
}: Props) => {
  const [graphStyle, setGraphStyle] = useState(loadGraphStyle);
  const style = useStyles2(getStyles);

  const CompareButton = (
    <>
      {setMegaSelectCompareFrame && (
        <Button
          variant="secondary"
          fill="solid"
          size="xs"
          onClick={() => {
            // debugger;
            if (megaSelectCompareFrame?.length && data.find((df) => df.name === megaSelectCompareFrame[0]?.name)) {
              setMegaSelectCompareFrame([]);
            } else {
              setMegaSelectCompareFrame(data);
            }
          }}
          className={style.compareButton}
        >
          {megaSelectCompareFrame?.length && data.find((df) => df.name === megaSelectCompareFrame[0]?.name)
            ? 'Unpin'
            : 'Pin'}
        </Button>
      )}
    </>
  );

  const onGraphStyleChange = useCallback((graphStyle: ExploreGraphStyle) => {
    storeGraphStyle(graphStyle);
    setGraphStyle(graphStyle);
  }, []);
  const { view, endpoint, mega: isMega } = options;

  const getTitle = () => {
    if (!isMega && view) {
      return `${view} by ${data[0]?.fields[1]?.labels?.__name__}`;
    } else if (view) {
      return `${view} of ${endpoint} endpoint`;
    }
    return '';
  };

  return (
    <PanelChrome
      title={getTitle()}
      width={width}
      height={height}
      loadingState={loadingState}
      statusMessage={statusMessage}
      actions={
        actionsOverride ? (
          CompareButton
        ) : (
          <ExploreGraphLabel graphStyle={graphStyle} onChangeGraphStyle={onGraphStyleChange} />
        )
      }
    >
      {(innerWidth, innerHeight) => (
        <>
          <MegaSelectGraph
            options={options}
            graphStyle={graphStyle}
            data={data}
            height={innerHeight}
            width={innerWidth}
            absoluteRange={absoluteRange}
            onChangeTime={onChangeTime}
            timeZone={timeZone}
            annotations={annotations}
            splitOpenFn={splitOpenFn}
            loadingState={loadingState}
            thresholdsConfig={thresholdsConfig}
            thresholdsStyle={thresholdsStyle}
            eventBus={eventBus}
            setMegaSelectCompareFrame={setMegaSelectCompareFrame}
          />
        </>
      )}
    </PanelChrome>
  );
};
