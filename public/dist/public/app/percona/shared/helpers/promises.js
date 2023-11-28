export const processPromiseResults = (requests) => Promise.all(requests.map((promise) => promise
    .then((value) => ({
    status: 'fulfilled',
    value,
}))
    .catch((reason) => ({
    status: 'rejected',
    reason,
}))));
export const filterFulfilled = ({ status }) => status === 'fulfilled';
export const filterRejected = ({ status }) => status === 'rejected';
//# sourceMappingURL=promises.js.map