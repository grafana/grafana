import { useEffect, useRef, useState } from 'react';

import { VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useDataTransformer } from '@grafana/scenes-react';
import {
  AxisPlacement,
  BarAlignment,
  GraphDrawStyle,
  LegendDisplayMode,
  StackingMode,
  TooltipDisplayMode,
  VisibilityMode,
} from '@grafana/schema';
import { Box } from '@grafana/ui';

import { overrideToFixedColor } from '../../home/Insights';
import { useWorkbenchContext } from '../WorkbenchContext';

/**
 * Viz config for the alert rule summary chart - used by the React component
 */
export const alertRuleSummaryVizConfig = VizConfigBuilders.timeseries()
  .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
  .setCustomFieldConfig('barWidthFactor', 1)
  .setCustomFieldConfig('barAlignment', BarAlignment.After)
  .setCustomFieldConfig('showPoints', VisibilityMode.Never)
  .setCustomFieldConfig('fillOpacity', 60)
  .setCustomFieldConfig('lineWidth', 0)
  .setCustomFieldConfig('stacking', { mode: StackingMode.None })
  .setCustomFieldConfig('axisPlacement', AxisPlacement.Hidden)
  .setCustomFieldConfig('axisGridShow', false)
  .setMin(0)
  .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
  .setOption('legend', {
    showLegend: false,
    displayMode: LegendDisplayMode.Hidden,
  })
  .setOverrides((builder) =>
    builder
      .matchFieldsWithName('firing')
      .overrideColor(overrideToFixedColor('firing'))
      .matchFieldsWithName('pending')
      .overrideColor(overrideToFixedColor('pending'))
  )
  .build();

/**
 * Component that contains the expensive hooks (queryRunner and data transformer).
 * This component only renders when AlertRuleSummary determines the viewport is approaching,
 * avoiding expensive CPU operations until necessary.
 */
function AlertRuleSummaryViz({ ruleUID }: { ruleUID: string }) {
  const { queryRunner } = useWorkbenchContext();

  // Transform parent data to filter by this specific rule and partition by alert state.
  // filterByRefId ensures we use only the range query (A) for charts, excluding the
  // instant badge query (B).
  const transformedData = useDataTransformer({
    data: queryRunner,
    transformations: [
      {
        id: 'filterByRefId',
        options: { include: 'A' },
      },
      {
        id: 'renameByRegex',
        options: {
          regex: 'Value #A',
          renamePattern: 'Value',
        },
      },
      {
        id: 'filterByValue',
        options: {
          filters: [
            {
              config: {
                id: 'equal',
                options: {
                  value: ruleUID,
                },
              },
              fieldName: 'grafana_rule_uid',
            },
          ],
          match: 'any',
          type: 'include',
        },
      },
      {
        id: 'partitionByValues',
        options: {
          fields: ['alertstate'],
          keepFields: false,
          naming: {
            asLabels: true,
          },
        },
      },
    ],
  });

  return (
    <VizPanel
      title=""
      viz={alertRuleSummaryVizConfig}
      dataProvider={transformedData}
      hoverHeader={true}
      displayMode="transparent"
      collapsible={false}
    />
  );
}

/**
 * Lazy-loaded component that uses Intersection Observer to only render the Viz component
 * when the row is approaching the viewport. This prevents expensive CPU operations
 * (queryRunner and data transformer) from running until necessary.
 */
export function AlertRuleSummary({ ruleUID }: { ruleUID: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Check if Intersection Observer is supported
    if (!window.IntersectionObserver) {
      // Fallback: render immediately if Intersection Observer is not supported
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Process only the last entry (most recent state)
        const entry = entries.at(-1);
        if (entry) {
          setIsVisible(entry.isIntersecting);
        }
      },
      {
        rootMargin: '100px', // Start loading when element is 100px away from viewport
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <Box ref={containerRef} width="100%" height="100%">
      {isVisible ? (
        <AlertRuleSummaryViz ruleUID={ruleUID} />
      ) : (
        // Placeholder while not visible - maintains layout space
        <Box width="100%" height="100%" />
      )}
    </Box>
  );
}
