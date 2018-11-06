import { LoadingState, TimeSeries, TimeRange } from './series';
import { PanelModel } from 'app/features/dashboard/panel_model';

export interface PanelProps<T = any> {
  timeSeries: TimeSeries[];
  timeRange: TimeRange;
  loading: LoadingState;
  options: T;
  renderCounter: number;
}

export interface PanelOptionsProps<T = any> {
  options: T;
  onChange: (options: T) => void;
}

export enum PanelHeaderMenuItemTypes { // TODO: Evaluate. Remove?
  Button = 'Button', // ?
  Divider = 'Divider',
  Link = 'Link',
  SubMenu = 'SubMenu',
}

export interface PanelHeaderMenuItemProps {
  type: PanelHeaderMenuItemTypes;
  text?: string;
  iconClassName?: string;
  handleClick?: () => void;
  shortcut?: string;
  children?: any;
  subMenu?: PanelHeaderMenuItemProps[];
  role?: string;
}

export interface PanelHeaderMenuAdditional {
  additionalMenuItems: PanelHeaderMenuItemProps[];
  additionalSubMenuItems: PanelHeaderMenuItemProps[];
}

export interface PanelHeaderGetMenuAdditional {
  (panel: PanelModel): PanelHeaderMenuAdditional;
}
