import { type LogListModel } from './processing';

export type PopoverStateType = {
  selection: string;
  selectedRow: LogListModel | null;
  popoverMenuCoordinates: { x: number; y: number };
};
