import { __awaiter } from "tslib";
// eslint-disable-next-line lodash/import-scope
import { renderHook } from '@testing-library/react-hooks';
import { omit } from 'lodash';
import { kubernetesStub } from '../__mocks__/kubernetesStubs';
import { useOperatorsComponentsVersions } from './ManageComponentsVersions.hooks';
import { psmdbComponentOptionsStubs, initialValuesStubs, operatorsOptionsStubs, possibleComponentOptionsStubs, versionsStubs, versionsFieldNameStub, omitDefaultLabels, } from './__mocks__/componentsVersionsStubs';
jest.mock('../../DBCluster/XtraDB.service');
jest.mock('../../DBCluster/PSMDB.service');
describe('ManageComponentsVersions.hooks::', () => {
    it('returns operator components options, versions and initial values with two operators', () => __awaiter(void 0, void 0, void 0, function* () {
        const wrapper = renderHook(() => useOperatorsComponentsVersions(kubernetesStub[0]));
        yield wrapper.waitForNextUpdate();
        const [initialValues, operatorsOptions, componentOptions, possibleComponentOptions, versionsOptions, versionsFieldName,] = wrapper.result.current;
        expect(omit(initialValues, omitDefaultLabels)).toEqual(omit(initialValuesStubs, omitDefaultLabels));
        expect(possibleComponentOptions).toEqual(possibleComponentOptionsStubs);
        expect(operatorsOptions).toEqual(operatorsOptionsStubs);
        expect(componentOptions).toEqual(psmdbComponentOptionsStubs);
        expect(versionsOptions).toEqual(versionsStubs);
        expect(versionsFieldName).toEqual(versionsFieldNameStub);
    }));
    it('returns operator components options, versions and initial values with one operator', () => __awaiter(void 0, void 0, void 0, function* () {
        const newOps = omit(kubernetesStub[0], 'operators.pxc');
        const wrapper = renderHook(() => useOperatorsComponentsVersions(newOps));
        yield wrapper.waitForNextUpdate();
        const [initialValues, operatorsOptions, componentOptions, possibleComponentOptions, versionsOptions, versionsFieldName,] = wrapper.result.current;
        expect(omit(initialValues, omitDefaultLabels)).toEqual(omit(initialValuesStubs, ['pxcpxc', 'pxchaproxy', 'pxcpxcdefault', 'pxchaproxydefault'].concat(omitDefaultLabels)));
        expect(possibleComponentOptions).toEqual(omit(possibleComponentOptionsStubs, 'pxc'));
        expect(operatorsOptions).toEqual([operatorsOptionsStubs[0]]);
        expect(componentOptions).toEqual(psmdbComponentOptionsStubs);
        expect(versionsOptions).toEqual(versionsStubs);
        expect(versionsFieldName).toEqual(versionsFieldNameStub);
    }));
});
//# sourceMappingURL=ManageComponentsVersions.hooks.test.js.map