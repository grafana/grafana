import { css } from '@emotion/css';
import { type Meta, type StoryObj } from '@storybook/react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { VizTooltipContent } from './VizTooltipContent';
import { VizTooltipHeader } from './VizTooltipHeader';
import { VizTooltipWrapper } from './VizTooltipWrapper';
import { type VizTooltipItem, type VizTooltipSize } from './types';

const headerItem: VizTooltipItem = {
  label: 'Time',
  value: '2024-01-01 12:00:00',
};

// A spread of short/long names and short/long values, used as fixed comparison content. `auto` must
// render these exactly as the old system (Baseline); `narrow` caps the width and splits each row so
// neither the name nor the value can push the other out (each ≤ 75%, so the other keeps ≥ 25%).
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

const Tooltip = ({ size }: { size?: VizTooltipSize }) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.surface}>
      <VizTooltipWrapper size={size}>
        <VizTooltipHeader item={headerItem} />
        <VizTooltipContent items={items} />
      </VizTooltipWrapper>
    </div>
  );
};

const meta: Meta<typeof VizTooltipWrapper> = {
  title: 'Plugins/VizTooltip',
  component: VizTooltipWrapper,
  argTypes: {
    size: {
      control: 'radio',
      options: ['auto', 'narrow'],
      description:
        '`auto` (default) grows to fit its content, exactly like the old system. `narrow` caps the width at the `sm` breakpoint and splits each row so the name and value each stay ≤ 75% (keeping the other ≥ 25%).',
    },
    children: { table: { disable: true } },
    className: { table: { disable: true } },
  },
  args: {
    size: 'auto',
  },
};

export default meta;

type Story = StoryObj<typeof VizTooltipWrapper>;

// The current (old-system) tooltip, rendered with no size prop. `auto` must always match this.
export const Baseline: Story = {
  parameters: { controls: { disable: true } },
  render: () => <Tooltip />,
};

// Toggle the `size` control to compare how the same content reflows.
export const Basic: Story = {
  render: ({ size }) => <Tooltip size={size} />,
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
