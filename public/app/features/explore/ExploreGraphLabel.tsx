import React from 'react';
import { cx, css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, RadioButtonGroup, Tooltip, useTheme2 } from '@grafana/ui';
import { ExploreGraphStyle, EXPLORE_GRAPH_STYLES } from 'app/core/utils/explore';

const ALL_GRAPH_STYLE_OPTIONS: Array<SelectableValue<ExploreGraphStyle>> = EXPLORE_GRAPH_STYLES.map((style) => ({
  value: style,
  // capital-case it and switch `_` to ` `
  label: style[0].toUpperCase() + style.slice(1).replace(/_/, ' '),
}));

const spacing = css({
  display: 'flex',
  justifyContent: 'space-between',
});

const getStyles = (theme: GrafanaTheme2) => {
  return {
    buttonMargins: css`
      margin: 0 ${theme.spacing(1)};
    `,
  };
};

type Props = {
  graphStyle: ExploreGraphStyle;
  onChangeGraphStyle: (style: ExploreGraphStyle) => void;
  onChangeBreakdowns: (isBreakdowns: boolean) => void;
  isBreakdowns: boolean;
  supportsBreakdowns: boolean;
};

export function ExploreGraphLabel(props: Props) {
  const { graphStyle, onChangeGraphStyle, isBreakdowns, onChangeBreakdowns, supportsBreakdowns } = props;
  const theme = useTheme2();
  const styles = getStyles(theme);
  let graphStyleOptions = ALL_GRAPH_STYLE_OPTIONS;
  return (
    <div className={spacing}>
      Graph
      <span>
        <RadioButtonGroup size="sm" options={graphStyleOptions} value={graphStyle} onChange={onChangeGraphStyle} />
        {supportsBreakdowns && (
          <Tooltip content="Show breakdown charts for all dimensions of the exemplars. When enabled, select an area in the chart to compare breakdown aggreations against the baseline.">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Show-auto-breakdowns-button"
              className={cx({ ['explore-active-button']: isBreakdowns, [styles.buttonMargins]: true })}
              onClick={onChangeBreakdowns as any}
            >
              Breakdowns
            </Button>
          </Tooltip>
        )}
      </span>
    </div>
  );
}
