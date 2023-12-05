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
  route?: string;
  target: string;
  content?: ReactNode;
  title?: ReactNode;
  placement?: Placement;
  requiredActions?: RequiredAction[];
  skip?: SkipCondition[];
};

type Attribite = {
  name: string;
  value: string | RegExp;
};

type SkipConditionVisible = {
  condition: 'visible';
  target: string;
};

type SkipConditionMatch = {
  condition: 'match';
  target: string;
  attribute: Attribite;
};

export type SkipCondition = SkipConditionVisible | SkipConditionMatch;

type RequiredActionBase = {
  target: string;
};

export type ClickAction = RequiredActionBase & {
  action: 'click' | 'change';
};

export type ChangeAction = RequiredActionBase & {
  action: 'change';
  attribute: Attribite;
};

export type RequiredAction = ClickAction | ChangeAction;
