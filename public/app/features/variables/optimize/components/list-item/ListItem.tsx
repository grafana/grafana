// BMC code starts
import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Icon, IconName, Label, styleMixins, stylesFactory, useTheme2, Checkbox } from '@grafana/ui';

export interface ListItemProps {
  item: SelectableValue;
  onClick: (item: SelectableValue) => void;
  onItemDrillDown?: (selected: SelectableValue) => void;
  iconName: IconName;
  iconTooltip?: string;
  testId?: string;
}
export const ListItem: React.FC<ListItemProps> = (props: ListItemProps) => {
  const theme = useTheme2();
  const styles = getResultsItemStyles(theme);
  const drillDownIconColor = props.item.selected ? theme.colors.action.disabledText : theme.colors.text.primary;
  const [showNoDrillDown, setShowNoDrillDown] = useState(false);

  return (
    <>
      <div
        data-testid={props.testId}
        className={cx(styles.wrapper)}
        style={{ width: '100%', padding: '4px 8px', display: 'flex', alignItems: 'center' }}
      >
        <Checkbox value={props.item.selected} onChange={() => props.onClick(props.item)} />

        <div style={{ width: '100%', display: 'flex', marginLeft: '8px' }}>
          <div
            onMouseEnter={() => setShowNoDrillDown(props.item.selected && props.item.hasChildren)}
            onMouseLeave={() => setShowNoDrillDown(false)}
            style={{
              cursor: !props.item.selected && props.item.hasChildren && props.onItemDrillDown ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              width: '100%',
            }}
            onClick={() => {
              if (!props.item.selected && props.item.hasChildren && props.onItemDrillDown) {
                props.onItemDrillDown(props.item);
              }
            }}
          >
            <div style={{ display: 'flex', marginTop: '5px', alignItems: 'center', width: '100%' }}>
              <Label description={props.item.description}>{props.item.label}</Label>
              {props.item.hasChildren && (
                <div style={{ marginLeft: 'auto', color: drillDownIconColor }}>
                  {' '}
                  <Icon name={showNoDrillDown ? 'minus-circle' : 'angle-right'} size={'lg'} />{' '}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const getResultsItemStyles = stylesFactory((theme: GrafanaTheme2) => ({
  wrapper: css`
    ${styleMixins.listItem(theme)};
  `,
}));
//BMC code ends
