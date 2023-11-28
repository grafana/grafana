import { psmdbComponentsVersionsStubs, versionsStub as versionsAPI } from '../../DBCluster/__mocks__/dbClustersStubs';
import { buildVersionsFieldName, componentsToOptions, findDefaultVersion, findRecommendedVersions, getDefaultOptions, requiredVersions, versionsToOptions, } from './ManageComponentsVersions.utils';
import { ManageComponentVersionsFields } from './ManageComponentsVersionsModal.types';
import { psmdbComponentOptionsStubs, versionsStubs as versions } from './__mocks__/componentsVersionsStubs';
describe('ManageComponentsVersions.utils::', () => {
    const values = {
        [ManageComponentVersionsFields.operator]: { value: 'test_operator' },
        [ManageComponentVersionsFields.component]: { value: 'test_component' },
    };
    it('checks that at least one version is checked', () => {
        expect(requiredVersions(versions)).toBeUndefined();
        expect(requiredVersions(versions.map((v) => (Object.assign(Object.assign({}, v), { value: false }))))).not.toBeUndefined();
    });
    it('converts components to options', () => {
        const components = psmdbComponentsVersionsStubs.versions[0].matrix;
        expect(componentsToOptions(components)).toEqual(psmdbComponentOptionsStubs);
    });
    it('converts versions to options', () => {
        expect(versionsToOptions(versionsAPI)).toEqual(versions);
    });
    it('builds versions field name', () => {
        expect(buildVersionsFieldName(values)).toEqual('test_operatortest_component');
    });
    it('finds recommended versions', () => {
        expect(findRecommendedVersions(versions).length).toBe(1);
        expect(findRecommendedVersions([versions[0]]).length).toBe(0);
    });
    it('finds default version', () => {
        expect(findDefaultVersion(versions)).toBe(versions[1]);
        expect(findDefaultVersion([versions[0]])).toBeUndefined();
    });
    it('returns default options', () => {
        const options = [
            { name: 'test option 1', value: true },
            { name: 'test option 2', value: false },
            { name: 'test option 3', value: true },
        ];
        const newValues = Object.assign(Object.assign({}, values), { test_operatortest_component: options });
        expect(getDefaultOptions(newValues).length).toBe(2);
    });
});
//# sourceMappingURL=ManageComponentsVersions.utils.test.js.map