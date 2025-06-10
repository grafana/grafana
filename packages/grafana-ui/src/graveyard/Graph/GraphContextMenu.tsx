import { css } from '@emotion/css';

import {
  FlotDataPoint,
  getValueFromDimension,
  Dimensions,
  dateTimeFormat,
  TimeZone,
  FormattedValue,
  GrafanaTheme2,
} from '@grafana/data';

import { ContextMenu, ContextMenuProps } from '../../components/ContextMenu/ContextMenu';
import { FormattedValueDisplay } from '../../components/FormattedValueDisplay/FormattedValueDisplay';
import { HorizontalGroup } from '../../components/Layout/Layout';
import { MenuGroup, MenuGroupProps } from '../../components/Menu/MenuGroup';
import { MenuItem } from '../../components/Menu/MenuItem';
import { SeriesIcon } from '../../components/VizLegend/SeriesIcon';
import { useStyles2 } from '../../themes/ThemeContext';

import { GraphDimensions } from './GraphTooltip/types';

/** @deprecated */
export type ContextDimensions<T extends Dimensions = any> = { [key in keyof T]: [number, number | undefined] | null };

/** @deprecated */
export type GraphContextMenuProps = ContextMenuProps & {
  getContextMenuSource: () => FlotDataPoint | null;
  timeZone?: TimeZone;
  itemsGroup?: MenuGroupProps[];
  dimensions?: GraphDimensions;
  contextDimensions?: ContextDimensions;
};

/** @internal */
export const GraphContextMenu = ({
  getContextMenuSource,
  timeZone,
  itemsGroup,
  dimensions,
  contextDimensions,
  ...otherProps
}: GraphContextMenuProps) => {
  const source = getContextMenuSource();

  //  Do not render items that do not have label specified
  const itemsToRender = itemsGroup
    ? itemsGroup.map((group) => ({
        ...group,
        items: group.items?.filter((item) => item.label),
      }))
    : [];

  const renderHeader = () => {
    if (!source) {
      return null;
    }

    // If dimensions supplied, we can calculate and display value
    let value;
    if (dimensions?.yAxis && contextDimensions?.yAxis?.[1]) {
      const valueFromDimensions = getValueFromDimension(
        dimensions.yAxis,
        contextDimensions.yAxis[0],
        contextDimensions.yAxis[1]
      );
      const display = source.series.valueField.display!;
      value = display(valueFromDimensions);
    }

    const formattedValue = dateTimeFormat(source.datapoint[0], {
      defaultWithMS: source.series.hasMsResolution,
      timeZone,
    });

    return (
      <GraphContextMenuHeader
        timestamp={formattedValue}
        seriesColor={source.series.color}
        displayName={source.series.alias || source.series.label}
        displayValue={value}
      />
    );
  };
  const renderMenuGroupItems = () => {
    return itemsToRender?.map((group, index) => (
      <MenuGroup key={`${group.label}${index}`} label={group.label}>
        {(group.items || []).map((item) => (
          <MenuItem
            key={`${item.label}`}
            url={item.url}
            label={item.label}
            target={item.target}
            icon={item.icon}
            active={item.active}
            onClick={item.onClick}
          />
        ))}
      </MenuGroup>
    ));
  };

  return <ContextMenu {...otherProps} renderMenuItems={renderMenuGroupItems} renderHeader={renderHeader} />;
};

/** @internal */
export const GraphContextMenuHeader = ({
  timestamp,
  seriesColor,
  displayName,
  displayValue,
}: {
  timestamp: string;
  seriesColor: string;
  displayName: string;
  displayValue: FormattedValue;
}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <strong>{timestamp}</strong>
      <HorizontalGroup>
        <div>
          <SeriesIcon color={seriesColor} />
          <span className={styles.displayName}>{displayName}</span>
        </div>
        {displayValue && <FormattedValueDisplay value={displayValue} />}
      </HorizontalGroup>
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      padding: theme.spacing(0.5, 1),
      fontSize: theme.typography.size.sm,
      zIndex: theme.zIndex.tooltip,
    }),
    displayName: css({
      whiteSpace: 'nowrap',
      paddingLeft: theme.spacing(0.5),
    }),
  };
}
