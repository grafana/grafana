import { generateOptions } from '../../components/Form/AsyncSelectFieldCore/__mocks__/mockAsyncSelectOptions';
export const loadAsyncOptions = () => new Promise((resolve) => {
    setTimeout(() => {
        resolve(generateOptions());
    }, 5000);
});
//# sourceMappingURL=loadAsyncOptions.js.map