export const sleep = (ms = 2000) => new Promise((resolve) => {
    setTimeout(() => {
        resolve();
    }, ms);
});
//# sourceMappingURL=sleep.js.map