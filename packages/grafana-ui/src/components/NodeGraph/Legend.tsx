import React from 'react';
import { VizLegend } from '../VizLegend/VizLegend';
import { LegendDisplayMode, VizLegendItem } from '../VizLegend/types';
import { NodeDatum } from './types';
import { Field, FieldColorModeId, getColorForTheme, GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes';
import { identity } from 'lodash';

interface Props {
  nodes: NodeDatum[];
  onClick: (itemData: ItemData) => void;
}

export const Legend = React.memo(function Legend(props: Props) {
  const { nodes, onClick } = props;

  const theme = useTheme();
  const colorItems = getColorLegendItems(nodes, theme);

  return (
    <VizLegend<ItemData>
      displayMode={LegendDisplayMode.List}
      placement={'right'}
      items={colorItems}
      onLabelClick={(item) => onClick(item.data!)}
    />
  );
});

interface ItemData {
  field: Field;
}

function getColorLegendItems(nodes: NodeDatum[], theme: GrafanaTheme): Array<VizLegendItem<ItemData>> {
  const fields = [nodes[0].mainStat, nodes[0].secondaryStat].filter(identity) as Field[];

  const node = nodes.find((n) => n.arcSections.length > 0);
  if (node) {
    if (node.arcSections[0]!.config?.color?.mode === FieldColorModeId.Fixed) {
      // We assume in this case we have a set of fixed colors which map neatly into a basic legend.

      // Lets collect and deduplicate as there isn't a requirement for 0 size arc section to be defined
      fields.push(...new Set(nodes.map((n) => n.arcSections).flat()));
    } else {
      // TODO: probably some sort of gradient which we will have to deal with later
      return [];
    }
  }

  return fields.map((f) => {
    return {
      label: f.config.displayName || f.name,
      color: getColorForTheme(f.config.color?.fixedColor || '', theme),
      yAxis: 0,
      data: { field: f },
    };
  });
}
