import { locationService } from '@grafana/runtime';

export const useHistory = () => {
  return {
    push: ({ query }: any) => {
      locationService.partial(query);
    },
  };
};
