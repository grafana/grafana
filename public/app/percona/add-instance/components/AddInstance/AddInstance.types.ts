import { IconName } from '@grafana/data';

import { InstanceAvailable, InstanceAvailableType } from '../../panel.types';

export interface SelectInstanceProps extends InstanceListItem {
  isSelected: boolean;
  selectInstanceType: (type: InstanceAvailableType) => () => void;
}

export interface AddInstanceProps {
  selectedInstanceType: InstanceAvailable;
  onSelectInstanceType: (arg: InstanceAvailable) => void;
  showAzure: boolean;
}

export interface InstanceListItem {
  type: InstanceAvailableType;
  icon?: IconName;
  title: string;
  isHidden?: boolean;
}
