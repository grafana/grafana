import { Databases } from '../../../../../shared/core';
import { Instance } from '../../Discovery.types';

export type OnSelectInstance = ({ type, credentials }: { type: Databases | string; credentials: any }) => void;

export interface InstancesTableProps {
  instances: Instance[];
  selectInstance: OnSelectInstance;
  loading: boolean;
  credentials: any;
}
