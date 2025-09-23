import { LatestInformation } from 'app/percona/shared/core/reducers/updates';

export interface AvailableUpdateProps {
  nextVersion?: LatestInformation;
  newsLink?: string;
}
