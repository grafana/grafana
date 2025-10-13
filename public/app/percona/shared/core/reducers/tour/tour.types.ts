import { ReactElement } from 'react';

export interface TourStep {
  navMenuId?: string;
  // Props used from StepType from @reactour/tour
  // Extending the whole type is causing a TS error:
  // "Type instantiation is excessively deep and possibly infinite."
  selector: string;
  content: ReactElement;
  position?: 'top' | 'right' | 'bottom' | 'left' | 'center' | [number, number];
  highlightedSelectors?: string[];
  resizeObservables?: string[];
  mutationObservables?: string[];
}

export enum TourType {
  Product = 'product',
  Alerting = 'alerting',
}

export interface TourState {
  isOpen: boolean;
  tour?: TourType;
  steps: Record<TourType, TourStep[]>;
}

export interface SetStepsActionPayload {
  tour: TourType;
  steps: TourStep[];
}
