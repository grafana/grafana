import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Icon } from '@grafana/ui';

export interface BreadCrumbsItemProps {
  items: SelectableValue[];
  onClick?: (item: SelectableValue) => void;
}
export const BreadCrumbs: React.FC<BreadCrumbsItemProps> = (props: BreadCrumbsItemProps) => {
  if (!props.items?.length) {
    return null;
  }

  return (
    <>
      <div style={{ display: 'flex' }}>
        {props.items.map((item, index) => {
          return (
            <div
              key={item.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginRight: '0px',
                paddingRight: '0px',
                marginLeft: '0px',
                paddingLeft: '0px',
              }}
            >
              <div
                style={{
                  marginLeft: '0px',
                  paddingLeft: '0px',
                  marginRight: '0px',
                  paddingRight: '0px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
                className="query-keyword pointer"
                onClick={() => (props.onClick ? props.onClick(item) : () => {})}
              >
                {item.label}
              </div>
              {index < props.items.length - 1 && <Icon name={'angle-right'} size={'lg'} />}
            </div>
          );
        })}
      </div>
    </>
  );
};
