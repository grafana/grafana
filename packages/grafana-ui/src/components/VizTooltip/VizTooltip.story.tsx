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

// A regular set of short name/value rows plus a single long value. A long value would blow an `auto`
// tooltip out to fit it on one line; toggling to `narrow` caps the width and wraps that value, so
// the whole tooltip visibly shrinks.
const basicItems: VizTooltipItem[] = [
  { label: 'cpu', value: '72.4%', color: '#73BF69' },
  { label: 'memory', value: '63.1%', color: '#8AB8FF' },
  { label: 'disk', value: '21.8%', color: '#B877D9' },
  {
    label: 'endpoint',
    value: 'https://prometheus-server-0.monitoring.svc.cluster.local:9090/api/v1/query_range',
    color: '#F2CC0C',
  },
];

// Each row covers one combination of short/long name and short/long value. A long name drives the
// tooltip's natural width (names render on one line), so `auto` grows past the `narrow` cap to fit
// it. `narrow` caps the box at the `sm` breakpoint and splits each row ~75/25: the name wraps within
// 75% while the value wraps but keeps at least 25% (right-aligned), so neither pushes the other out.
const longLabelItems: VizTooltipItem[] = [
  // short name, short value
  { label: 'cpu', value: '72.4%', color: '#73BF69' },
  // long name, short value
  {
    label:
      'node_network_receive_bytes_total{instance="prometheus-server-0",device="eth0",job="node-exporter",mode="rx"}',
    value: '48.2 MB/s',
    color: '#8AB8FF',
  },
  // short name, long value
  {
    label: 'endpoint',
    value: 'https://prometheus-server-0.monitoring.svc.cluster.local:9090/api/v1/query_range',
    color: '#F2CC0C',
  },
  // long name, long value
  {
    label: 'node_network_transmit_bytes_total{instance="prometheus-server-0",device="eth0"}',
    value: 'https://prometheus-server-0.monitoring.svc.cluster.local:9090/metrics',
    color: '#FF9830',
  },
];

const Tooltip = ({ size, items }: { size: VizTooltipSize; items: VizTooltipItem[] }) => {
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
        '`narrow` caps the tooltip width at the theme `sm` breakpoint and splits each row ~75/25 (label name wraps within 75%, value keeps at least 25%); `auto` (default) grows to fit its content.',
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

// A regular set of rows with one long value. Toggle the `size` control between `auto` and `narrow`
// to watch the long value wrap and the whole tooltip shrink.
export const Basic: Story = {
  render: ({ size = 'auto' }) => <Tooltip size={size} items={basicItems} />,
};

// The four combinations of short/long name and short/long value. Toggle the `size` control to
// compare how each row reflows between `auto` and `narrow`.
export const LongLabels: Story = {
  render: ({ size = 'auto' }) => <Tooltip size={size} items={longLabelItems} />,
};

const getStyles = (theme: GrafanaTheme2) => ({
  // Minimal tooltip-like surface so the wrapper's width is visible. Intentionally omits the real
  // container's own max-width and padding so `size` alone drives the box width in this story.
  // `fit-content` lets the box grow to its content (bounded by the wrapper's own max-width).
  surface: css({
    display: 'inline-block',
    width: 'fit-content',
    // Real tooltips live inside a container that clips overflow; mirror that so a capped `narrow`
    // tooltip clips its content at the box edge instead of letting it spill outside.
    overflow: 'hidden',
    background: theme.colors.background.elevated,
    boxShadow: theme.shadows.z2,
    borderRadius: theme.shape.radius.default,
  }),
});
