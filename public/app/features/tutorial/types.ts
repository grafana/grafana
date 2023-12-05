import { Placement } from '@popperjs/core';
import { type ReactNode } from 'react';

export type Tutorial = {
  id: string;
  name: string;
  description: string;
  steps: Step[];
  furthestStepCompleted?: number;
};

export type Step = {
  route: string;
  target: string;
  content?: ReactNode;
  title?: ReactNode;
  placement?: Placement;
  requiredActions?: RequiredAction[];
};

type RequiredActionBase = {
  target: string;
};

export type ClickAction = RequiredActionBase & {
  action: 'click' | 'change';
};

export type ChangeAction = RequiredActionBase & {
  action: 'change';
  attribute: { name: string; value: string };
};

export type RequiredAction = ClickAction | ChangeAction;
