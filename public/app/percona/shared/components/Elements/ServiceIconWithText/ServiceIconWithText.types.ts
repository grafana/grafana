import { Databases } from 'app/percona/shared/core';

export interface ServiceIconWithTextProps {
  dbType: Databases | string;
  text: string;
}
