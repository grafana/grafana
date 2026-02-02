import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { ControlledCollapse, IconName, stylesFactory, useTheme2, VerticalGroup } from '@grafana/ui';

import { SelectableList } from '../seleactable-list/SelectableList';

export interface SelectableListGroupProps {
  items: SelectableValue[];
  onClick: (selected: SelectableValue) => void;
  onItemDrillDown?: (selected: SelectableValue) => void;
  listItem: {
    iconName: IconName;
    iconTooltip?: string;
  };
}

interface GroupItem {
  items: SelectableValue[];
  group?: string;
}
export const SelectableListGroup: React.FC<SelectableListGroupProps> = (props: SelectableListGroupProps) => {
  const [groupedItems, setGroupedItems] = useState<GroupItem[]>([]);
  const [displayCollapse, setDisplayCollapse] = useState(false);

  const theme = useTheme2();
  const styles = getResultsItemStyles(theme);

  useEffect(() => {
    const groupMap = props.items.reduce((acc, curr) => {
      const group = curr.group || '';
      let groupItem = acc.get(group);
      if (!groupItem) {
        groupItem = { items: [], group: group };
        acc.set(group, groupItem);
      }
      groupItem.items.push(curr);
      return acc;
    }, new Map<string, GroupItem>());
    setGroupedItems(Array.from(groupMap.values()));
    const groupKeys = Array.from(groupMap.keys());
    const oneGroupNoName = groupKeys.length === 1 && groupKeys[0] === '';
    setDisplayCollapse(!oneGroupNoName);
  }, [props.items]);

  if (groupedItems.length === 0) {
    return <></>;
  }

  return (
    <>
      <div style={{ backgroundColor: theme.colors.background.primary, width: '100%' }}>
        <VerticalGroup>
          {displayCollapse
            ? groupedItems.map((group, indx) => {
                return (
                  <ControlledCollapse label={group.group} key={indx} isOpen={indx === 0} className={styles.container}>
                    <div style={{ marginLeft: '12px' }}>
                      <SelectableList
                        listItem={props.listItem}
                        items={group.items}
                        group={group.group}
                        onClick={props.onClick}
                      />
                    </div>
                  </ControlledCollapse>
                );
              })
            : groupedItems.map((group, indx) => {
                return (
                  <SelectableList
                    listItem={props.listItem}
                    items={group.items}
                    group={group.group}
                    key={indx}
                    onClick={props.onClick}
                    onItemDrillDown={props.onItemDrillDown}
                  />
                );
              })}
        </VerticalGroup>
      </div>
    </>
  );
};

const getResultsItemStyles = stylesFactory((theme: GrafanaTheme2) => ({
  container: css`
    margin-bottom: 0px;
  `,
}));
