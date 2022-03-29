import { CheckDetails } from 'app/percona/check/types';

/**
 * A mock version of CheckService
 */
export const CheckService = {
  async runDbChecks(): Promise<void | {}> {
    return {};
  },
  async getAllChecks(): Promise<CheckDetails[] | undefined> {
    return [];
  },
  async changeCheck(): Promise<void | {}> {
    return {};
  },
};
