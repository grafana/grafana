import { Placement } from '@popperjs/core';
import { type ReactNode } from 'react';

export type Tutorial = {
  id: string;
  name: string;
  description: string;
  author: string;
  steps: Step[];
  furthestStepCompleted?: number;
};

export type Step = {
  route?: string;
  target: string;
  content: ReactNode;
  title: ReactNode;
  placement?: Placement;
  requiredActions?: RequiredAction[];
  skipConditions?: SkipCondition[];
};

export type StringAttribute = {
  name: string;
  value: string;
};

export type RegExpAttribute = {
  name: string;
  regEx: string;
};

export type Attribute = StringAttribute | RegExpAttribute;

type SkipConditionVisible = {
  condition: 'visible';
  target: string;
};

type SkipConditionMatch = {
  condition: 'match';
  target: string;
  attribute: Attribute;
};

export type SkipCondition = SkipConditionVisible | SkipConditionMatch;

type RequiredActionBase = {
  target: string;
};

export type ClickAction = RequiredActionBase & {
  action: 'click';
};

export type ChangeAction = RequiredActionBase & {
  action: 'change';
  attribute: Attribute;
};

export type InputAction = RequiredActionBase & {
  action: 'input';
  regEx: string;
};

export type RequiredAction = ClickAction | ChangeAction | InputAction;
