import { FormApi } from 'final-form';

export enum NetworkAndSecurityFields {
  expose = 'expose',
  internetFacing = 'internetFacing',
  sourceRanges = 'sourceRanges',
}

export interface NetworkAndSecurityProps {
  form: FormApi;
}
