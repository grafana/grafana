import React, { useCallback } from 'react';
import { NodeDatum } from './types';
import { Field, FieldColorModeId, getColorForTheme, GrafanaTheme } from '@grafana/data';
import { identity } from 'lodash';
import { Config } from './layout';
import { css } from '@emotion/css';
import { Icon, LegendDisplayMode, useStyles, useTheme, VizLegend, VizLegendItem, VizLegendListItem } from '@grafana/ui';

function getStyles() {
  return {
    item: css`
      label: LegendItem;
      flex-grow: 0;
    `,

    legend: css`
      label: Legend;
      pointer-events: all;
    `,
  };
}

interface Props {
  nodes: NodeDatum[];
  onSort: (sort: Config['sort']) => void;
  sort?: Config['sort'];
  sortable: boolean;
}

export const Legend = function Legend(props: Props) {
  const { nodes, onSort, sort, sortable } = props;

  const theme = useTheme();
  const styles = useStyles(getStyles);
  const colorItems = getColorLegendItems(nodes, theme);

  const onClick = useCallback(
    (item) => {
      onSort({
        field: item.data!.field,
        ascending: item.data!.field === sort?.field ? !sort?.ascending : false,
      });
    },
    [sort, onSort]
  );

  return (
    <VizLegend<ItemData>
      className={styles.legend}
      displayMode={LegendDisplayMode.List}
      placement={'bottom'}
      items={colorItems}
      itemRenderer={(item) => {
        return (
          <>
            <VizLegendListItem item={item} className={styles.item} onLabelClick={sortable ? onClick : undefined} />
            {sortable &&
              (sort?.field === item.data!.field ? <Icon name={sort!.ascending ? 'arrow-up' : 'arrow-down'} /> : '')}
          </>
        );
      }}
    />
  );
};

interface ItemData {
  field: Field;
}

function getColorLegendItems(nodes: NodeDatum[], theme: GrafanaTheme): Array<VizLegendItem<ItemData>> {
  if (!nodes.length) {
    return [];
  }
  const fields = [nodes[0].mainStat, nodes[0].secondaryStat].filter(identity) as Field[];

  const node = nodes.find((n) => n.arcSections.length > 0);
  if (node) {
    if (node.arcSections[0]!.config?.color?.mode === FieldColorModeId.Fixed) {
      // We assume in this case we have a set of fixed colors which map neatly into a basic legend.

      // Lets collect and deduplicate as there isn't a requirement for 0 size arc section to be defined
      fields.push(...new Set(nodes.map((n) => n.arcSections).flat()));
    }
  }

  if (nodes[0].color) {
    fields.push(nodes[0].color);
  }

  return fields.map((f) => {
    const item: VizLegendItem = {
      label: f.config.displayName || f.name,
      yAxis: 0,
      data: { field: f },
    };
    if (f.config.color?.mode === FieldColorModeId.Fixed && f.config.color?.fixedColor) {
      item.color = getColorForTheme(f.config.color?.fixedColor || '', theme);
    } else if (f.config.color?.mode) {
      item.gradient = f.config.color?.mode;
    }

    if (!(item.color || item.gradient)) {
      // Defaults to gray color
      item.color = getColorForTheme('', theme);
    }

    return item;
  });
}
