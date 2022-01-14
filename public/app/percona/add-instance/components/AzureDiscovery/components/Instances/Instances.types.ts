import { Instance } from '../../Discovery.types';
import { Databases } from '../../../../../shared/core';

export type OnSelectInstance = ({ type, credentials }: { type: Databases | string; credentials: any }) => void;

export interface InstancesTableProps {
  instances: Instance[];
  selectInstance: OnSelectInstance;
  loading: boolean;
  credentials: any;
}
