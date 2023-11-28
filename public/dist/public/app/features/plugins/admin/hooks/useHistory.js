import { locationService } from '@grafana/runtime';
export const useHistory = () => {
    return {
        push: ({ query }) => {
            locationService.partial(query);
        },
    };
};
//# sourceMappingURL=useHistory.js.map