import { css } from '@emotion/css';
import { type Meta, type StoryObj } from '@storybook/react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { VizTooltipContent } from './VizTooltipContent';
import { VizTooltipHeader } from './VizTooltipHeader';
import { VizTooltipWrapper } from './VizTooltipWrapper';
import { type VizTooltipItem } from './types';

const headerItem: VizTooltipItem = {
  label: 'Time',
  value: '2024-01-01 12:00:00',
};

// A spread of short/long names and short/long values, used as the fixed comparison content while we
// (re)build the tooltip sizing. This is the baseline fixture: whatever the sizing feature does later,
// its `auto` mode must render this identically to the current `Baseline` story.
const items: VizTooltipItem[] = [
  { label: 'cpu', value: '72.4%', color: '#73BF69' },
  {
    label: 'endpoint',
    value: 'https://prometheus-server-0.monitoring.svc.cluster.local:9090/api/v1/query_range',
    color: '#F2CC0C',
  },
  {
    label:
      'node_network_receive_bytes_total{instance="prometheus-server-0",device="eth0",job="node-exporter",mode="rx"}',
    value: '48.2 MB/s',
    color: '#8AB8FF',
  },
  {
    label: 'node_network_transmit_bytes_total{instance="prometheus-server-0",device="eth0"}',
    value: 'https://prometheus-server-0.monitoring.svc.cluster.local:9090/metrics',
    color: '#FF9830',
  },
];

const meta: Meta<typeof VizTooltipWrapper> = {
  title: 'Plugins/VizTooltip',
  component: VizTooltipWrapper,
};

export default meta;

type Story = StoryObj<typeof VizTooltipWrapper>;

// The current (old-system) tooltip, exactly as it renders today — no size options, no max-width.
// This is the visual baseline we are locking in before changing any CSS.
export const Baseline: Story = {
  render: function BaselineTooltip() {
    const styles = useStyles2(getStyles);
    return (
      <div className={styles.surface}>
        <VizTooltipWrapper>
          <VizTooltipHeader item={headerItem} />
          <VizTooltipContent items={items} />
        </VizTooltipWrapper>
      </div>
    );
  },
};

const getStyles = (theme: GrafanaTheme2) => ({
  // A minimal tooltip-like surface so the wrapper's own width behaviour is visible, mirroring the
  // real container's background/shadow/clip without imposing its own max-width.
  surface: css({
    display: 'inline-block',
    width: 'fit-content',
    overflow: 'hidden',
    background: theme.colors.background.elevated,
    boxShadow: theme.shadows.z2,
    borderRadius: theme.shape.radius.default,
  }),
});
