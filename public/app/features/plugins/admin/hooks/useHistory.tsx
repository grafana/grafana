import { locationService } from '@grafana/runtime';

export const useHistory = () => {
  return {
    push: ({ query }: { query: Parameters<typeof locationService.partial>[0] }) => {
      locationService.partial(query);
    },
  };
};
