import { ReactNode } from 'react';
import { Control, UseFormGetValues, UseFormRegister, UseFormSetValue } from 'react-hook-form';

import { DataLinkTransformationConfig, ExploreCorrelationHelperData } from '@grafana/data';

export enum CorrelationType {
  ExploreQuery = 'Explore Query',
  Link = 'Link',
}

export interface CorrelationHelperProps {
  exploreId: string;
  correlations: ExploreCorrelationHelperData;
}

export interface FormValues {
  type: CorrelationType;
  label: string;
  description: string;
  url?: string;
}

export interface TransformationHandlers {
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
  onModalCancel: () => void;
  onModalSave: (transformation: DataLinkTransformationConfig) => void;
}

export interface CorrelationFormInformationProps {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  getValues: UseFormGetValues<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  defaultLabel: string | undefined;
  selectedType: CorrelationType;
}

export interface CorrelationFormCustomVariablesProps {
  correlations: ExploreCorrelationHelperData;
  transformations: DataLinkTransformationConfig[];
  handlers: TransformationHandlers;
}

export interface FormSectionProps {
  title: JSX.Element;
  children: ReactNode;
}
