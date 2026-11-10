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

// Rows covering each combination of short/long name and short/long value. A long name drives the
// tooltip's natural width (names render on one line), so `auto` grows past the `narrow` cap to fit
// it. `narrow` caps the box at the `sm` breakpoint and splits each row ~75/25: the name wraps within
// 75% while the value wraps but keeps at least 25% (right-aligned), so neither pushes the other out.
const items: VizTooltipItem[] = [
  // short name, short value
  { label: 'cpu', value: '72.4%', color: '#73BF69' },
  // short name, long value
  {
    label: 'endpoint',
    value: 'https://prometheus-server-0.monitoring.svc.cluster.local:9090/api/v1/query_range',
    color: '#F2CC0C',
  },
  // long name, short value
  {
    label:
      'node_network_receive_bytes_total{instance="prometheus-server-0",device="eth0",job="node-exporter",mode="rx"}',
    value: '48.2 MB/s',
    color: '#8AB8FF',
  },
  // long name, long value
  {
    label: 'node_network_transmit_bytes_total{instance="prometheus-server-0",device="eth0"}',
    value: 'https://prometheus-server-0.monitoring.svc.cluster.local:9090/metrics',
    color: '#FF9830',
  },
];

const Tooltip = ({ size }: { size: VizTooltipSize }) => {
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
    size: 'narrow',
  },
};

export default meta;

type Story = StoryObj<typeof VizTooltipWrapper>;

// The default tooltip, rendered with no `size` prop. This is the baseline — how the tooltip renders
// on `main` today, and identical to the `auto` variant. The `narrow` work is purely additive, so
// this default is unchanged by it.
export const Default: Story = {
  parameters: { controls: { disable: true } },
  render: function DefaultTooltip() {
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

// Toggle the `size` control to compare how the same content reflows.
export const Basic: Story = {
  render: ({ size = 'auto' }) => <Tooltip size={size} />,
};

// Same content rendered at both sizes so the width/wrapping difference is directly comparable.
export const AutoVsNarrow: Story = {
  parameters: { controls: { disable: true } },
  render: function Comparison() {
    const styles = useStyles2(getStyles);
    return (
      <div className={styles.comparison}>
        <div className={styles.example}>
          <div className={styles.caption}>size=&quot;auto&quot; — grows to fit the long series label</div>
          <Tooltip size="auto" />
        </div>
        <div className={styles.example}>
          <div className={styles.caption}>
            size=&quot;narrow&quot; — capped at the sm breakpoint; label wraps (≤75%), value keeps ≥25%
          </div>
          <Tooltip size="narrow" />
        </div>
      </div>
    );
  },
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
  // Plain block flow on purpose: a flex parent collapses each tooltip's shrink-to-fit width, which
  // would hide the difference by boxing both sizes to the same narrow width.
  comparison: css({
    display: 'block',
  }),
  example: css({
    marginBottom: theme.spacing(4),
  }),
  caption: css({
    marginBottom: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
