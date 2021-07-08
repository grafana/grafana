import { getLocationSrv } from '@grafana/runtime';

export const useHistory = () => {
  return {
    push: ({ query }: any) => {
      getLocationSrv().update({
        partial: true,
        replace: false,
        query,
      });
    },
  };
};
